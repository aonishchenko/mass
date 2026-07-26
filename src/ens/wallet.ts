/**
 * Sign-in with an Ethereum wallet, identified by its ENS name.
 *
 * WHAT THIS PROVES, AND WHAT IT DOES NOT
 *
 * A signature proves control of a key. It does NOT prove a unique human — one
 * person can hold a thousand wallets in a minute, and that is precisely the
 * attack the cap table has to resist. So a wallet seat is deliberately weaker
 * than a World seat, and is labelled as such everywhere it appears:
 *
 *   World  → verified unique human   → may reach Signer, co-sign, earn equity
 *   Wallet → verified key holder     → Builder at most, marked wallet-verified
 *
 * The value it adds is identity, not uniqueness: the seat arrives already
 * carrying a resolvable ENS name, so citations point at a name that existed
 * before this session and can be checked outside it.
 */

import { resolveName, type EnsEnv } from "./ens.js";

/** How long a login challenge stays valid. Short: it is replayable until used. */
const NONCE_TTL_MS = 5 * 60_000;

export interface WalletChallenge {
  session: string;
  nonce: string;
  issuedAt: number;
  statement: string;
}

/**
 * The exact text the wallet signs. It names the session and a nonce, so a
 * signature captured in one room cannot seat its holder in another, and cannot
 * be replayed after it expires.
 */
export function challengeMessage(session: string, nonce: string, issuedAt: number): string {
  return [
    "MASS — claim a seat",
    "",
    "Signing this proves you control this wallet.",
    "It does NOT prove you are a unique human — that is what World verification is for.",
    "",
    `Session: ${session}`,
    `Nonce: ${nonce}`,
    `Issued: ${new Date(issuedAt).toISOString()}`,
  ].join("\n");
}

export function newChallenge(session: string): WalletChallenge {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const issuedAt = Date.now();
  return { session, nonce, issuedAt, statement: challengeMessage(session, nonce, issuedAt) };
}

export interface WalletVerifyResult {
  ok: boolean;
  address?: string;
  /** Primary (reverse) name, when the wallet has one. */
  ensName?: string;
  /** True when forward and reverse resolution agree. */
  ensVerified?: boolean;
  error?: string;
}

/**
 * Recovers the signer and resolves its ENS identity.
 *
 * The address is recovered from the signature — never taken from the client.
 * A client that simply claims an address proves nothing.
 */
export async function verifyWalletLogin(
  env: EnsEnv,
  args: { session: string; nonce: string; issuedAt: number; signature: string }
): Promise<WalletVerifyResult> {
  const age = Date.now() - args.issuedAt;
  if (!Number.isFinite(args.issuedAt) || age < 0 || age > NONCE_TTL_MS) {
    return { ok: false, error: "Login challenge expired — try again." };
  }

  const message = challengeMessage(args.session, args.nonce, args.issuedAt);

  let address: string;
  try {
    const { recoverMessageAddress } = await import("viem");
    address = await recoverMessageAddress({
      message,
      signature: args.signature as `0x${string}`,
    });
  } catch (err) {
    return { ok: false, error: `Could not verify signature: ${String(err).slice(0, 120)}` };
  }

  // Reverse-resolve so the seat is named by ENS rather than by a hex string.
  // A wallet with no primary name still gets a seat; it just has no ENS
  // identity to show, which the UI states plainly rather than printing hex.
  let ensName: string | undefined;
  let ensVerified = false;
  try {
    const { createPublicClient, http } = await import("viem");
    const { mainnet, sepolia } = await import("viem/chains");
    if (env.ENS_L1_RPC) {
      const chain = env.ENS_CHAIN === "sepolia" ? sepolia : mainnet;
      const client = createPublicClient({ chain, transport: http(env.ENS_L1_RPC) });
      const primary = await client.getEnsName({ address: address as `0x${string}` });
      if (primary) {
        // Trust the reverse record only when the forward record agrees.
        const forward = await resolveName(env, primary);
        if (forward.address?.toLowerCase() === address.toLowerCase()) {
          ensName = primary;
          ensVerified = forward.verified;
        }
      }
    }
  } catch {
    // No ENS identity is not a login failure — it is a seat without a name.
  }

  return { ok: true, address, ensName, ensVerified };
}
