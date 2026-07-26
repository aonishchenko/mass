/**
 * Sign-in with an Ethereum wallet, using its ENS name as the identity.
 *
 * Weaker than World on purpose: a signature proves key control, not a unique
 * human. The server records which door a seat came through; this module only
 * collects the signature.
 */

export interface WalletLogin {
  token: string;
  address: string;
  ensName?: string;
  ensVerified?: boolean;
}

interface Eip1193 {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  isMetaMask?: boolean;
}

interface Eip6963Detail {
  info: { uuid: string; name: string; icon: string; rdns: string };
  provider: Eip1193;
}

/**
 * Find the wallet, the way the standard says to.
 *
 * `window.ethereum` is a single slot that every installed extension writes to,
 * and the last one to load wins — so on a machine with more than one wallet we
 * were asking whichever extension happened to boot last, and getting its
 * "No active wallet found" back while MetaMask sat there unlocked and ignored.
 * `providers[]` was the old workaround and modern MetaMask no longer sets it.
 *
 * EIP-6963 replaced both: wallets announce themselves in response to an event,
 * so every installed one is discoverable by name instead of by luck.
 */
const announced = new Map<string, Eip6963Detail>();

if (typeof window !== "undefined") {
  window.addEventListener("eip6963:announceProvider", (event: Event) => {
    const d = (event as CustomEvent<Eip6963Detail>).detail;
    if (d?.info?.rdns) announced.set(d.info.rdns, d);
  });
  // Wallets that loaded before this listener re-announce when asked.
  window.dispatchEvent(new Event("eip6963:requestProvider"));
}

function discovered(): Eip6963Detail | undefined {
  // Extensions can inject after this module loads, so ask again while the map
  // is empty. Wallets answer synchronously, which is why a re-ask is enough and
  // no waiting is needed.
  if (announced.size === 0 && typeof window !== "undefined") {
    window.dispatchEvent(new Event("eip6963:requestProvider"));
  }
  if (announced.size === 0) return undefined;
  const byRdns = announced.get("io.metamask");
  if (byRdns) return byRdns;
  for (const d of announced.values()) {
    if (d.provider?.isMetaMask) return d;
  }
  return announced.values().next().value;
}

function provider(): Eip1193 | undefined {
  return (
    discovered()?.provider ??
    // Last resort: a wallet too old to announce itself. Whatever is in the slot
    // is better than refusing to try.
    (globalThis as { ethereum?: Eip1193 }).ethereum
  );
}

/** Which wallet we will actually talk to — shown on the button so it is not a surprise. */
export const walletName = (): string | undefined => discovered()?.info.name;

export const hasWallet = () => Boolean(provider());

/** Anything a provider rejects with, turned into something a human can act on. */
function describe(err: unknown): string {
  // Provider errors are frequently plain objects, NOT Error instances — which
  // is exactly how this path used to end up reporting a bare "sign-in failed"
  // while throwing away the code that said what went wrong.
  const e = err as { code?: number | string; message?: string; data?: { message?: string } };
  const code = e?.code;

  if (code === 4001) return "You rejected the signature in your wallet.";
  if (code === -32002) {
    return "Your wallet already has a request open — open the extension and finish or dismiss it, then try again.";
  }
  if (code === 4900 || code === 4901) return "Your wallet is locked or disconnected. Unlock it and try again.";

  const msg = e?.data?.message ?? e?.message ?? (typeof err === "string" ? err : "");
  if (/no active wallet|no accounts|not set up/i.test(msg)) {
    return `${walletName() ?? "That wallet"} has no account set up. Unlock it, or install MetaMask.`;
  }
  return msg ? `Wallet sign-in failed: ${msg}` : "Wallet sign-in failed (no reason given by the wallet).";
}

class WalletError extends Error {
  constructor(cause: unknown) {
    super(describe(cause));
    this.name = "WalletError";
    // Keep the original around: the console is where this gets diagnosed.
    console.error("[wallet] sign-in failed", cause);
  }
}

/** EIP-191 wants hex. MetaMask tolerates a bare string; not every wallet does. */
function toHex(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let out = "0x";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

export async function loginWithWallet(sessionId: string): Promise<WalletLogin> {
  const eth = provider();
  if (!eth) {
    throw new Error("No Ethereum wallet found — install MetaMask or use World verification.");
  }

  // Ask for what is already granted first. Calling eth_requestAccounts when a
  // permission prompt is already open is what produces -32002, and the second
  // click that triggers it is the natural thing to do when the first appears
  // to hang.
  let address: string | undefined;
  try {
    const existing = (await eth.request({ method: "eth_accounts" })) as string[];
    address = existing?.[0];
  } catch {
    /* not fatal — fall through to the explicit request */
  }

  if (!address) {
    try {
      const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      address = accounts?.[0];
    } catch (err) {
      throw new WalletError(err);
    }
  }
  if (!address) throw new Error("No account authorised in your wallet.");

  // The server composes the message it will verify against; we never invent it
  // here, or a client could sign something the server never issued.
  const qs = `session=${encodeURIComponent(sessionId)}`;
  const res0 = await fetch(`/api/verify/wallet/challenge?${qs}`);
  if (!res0.ok) throw new Error(`Could not start wallet sign-in (${res0.status}).`);
  const challenge = (await res0.json()) as { nonce: string; issuedAt: number; statement: string };
  if (!challenge?.statement) throw new Error("Sign-in challenge was malformed.");

  let signature: string;
  try {
    signature = (await eth.request({
      method: "personal_sign",
      params: [toHex(challenge.statement), address],
    })) as string;
  } catch (err) {
    throw new WalletError(err);
  }

  const res = await fetch(`/api/verify/wallet?${qs}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      nonce: challenge.nonce,
      issuedAt: challenge.issuedAt,
      signature,
    }),
  });
  const j = (await res.json().catch(() => ({}))) as WalletLogin & { ok?: boolean; error?: string };
  if (!res.ok || !j.ok || !j.token) throw new Error(j.error ?? "Wallet verification failed");

  return { token: j.token, address: j.address, ensName: j.ensName, ensVerified: j.ensVerified };
}
