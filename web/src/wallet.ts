/**
 * Sign-in with an Ethereum wallet, using its ENS name as the identity.
 *
 * Weaker than World on purpose: a signature proves key control, not a unique
 * human. The server caps these seats at Builder and labels them; this module
 * only collects the signature.
 */

export interface WalletLogin {
  token: string;
  address: string;
  ensName?: string;
  ensVerified?: boolean;
}

interface Eip1193 {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

const eth = () => (globalThis as { ethereum?: Eip1193 }).ethereum;

export const hasWallet = () => Boolean(eth());

export async function loginWithWallet(sessionId: string): Promise<WalletLogin> {
  const provider = eth();
  if (!provider) {
    throw new Error("No Ethereum wallet found — install MetaMask or use World verification.");
  }

  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
  const address = accounts?.[0];
  if (!address) throw new Error("No account authorised.");

  // The server composes the message it will verify against; we never invent it
  // here, or a client could sign something the server never issued.
  const qs = `session=${encodeURIComponent(sessionId)}`;
  const challenge = (await (
    await fetch(`/api/verify/wallet/challenge?${qs}`)
  ).json()) as { nonce: string; issuedAt: number; statement: string };

  const signature = (await provider.request({
    method: "personal_sign",
    params: [challenge.statement, address],
  })) as string;

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
