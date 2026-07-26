/**
 * ENS v2 WRITE path — actually issuing the subnames we display.
 *
 * Until now MASS *derived* names (`niek.mass-lisbon.eth`) and displayed them.
 * Derivation is not issuance: nothing existed on-chain, so nothing resolved for
 * anyone outside our app. This module registers them for real against an ENS v2
 * PermissionedRegistry and writes the ENSIP-25/26/27 records on the resolver.
 *
 * Interfaces (ensdomains/contracts-v2):
 *   IRegistry              read-only  — getSubregistry / getResolver / getParent
 *   IPermissionedRegistry  state      — getStatus / getTokenId / getOwner
 *   IStandardRegistry      writes     — register / setResolver / renew / unregister
 *
 * Three rules this module keeps, matching the rest of the codebase:
 *
 *   1. Never block a session on a chain write. Registration is queued; a seat
 *      works immediately whether or not its name has landed yet.
 *   2. Never claim success without a receipt. A name is only reported as
 *      registered when a transaction confirmed it.
 *   3. Never re-register. Status is checked first, so a replayed session or a
 *      retry cannot mint twice or revert the whole batch.
 */

import type { EnsEnv } from "./ens.js";

export interface RegistrarEnv extends EnsEnv {
  /** ENS v2 PermissionedRegistry that issues subnames under our parent. */
  ENS_REGISTRY_ADDRESS?: string;
  /** Resolver assigned to each new subname (where text records are written). */
  ENS_RESOLVER_ADDRESS?: string;
  /** Private key holding the registrar role on that registry. SECRET. */
  ENS_REGISTRAR_KEY?: string;
  /** Chain the registry lives on. Default Base Sepolia (84532). */
  ENS_REGISTRY_CHAIN_ID?: string;
  /** RPC for that chain. */
  ENS_REGISTRY_RPC?: string;
  /**
   * Role bitmap granted to the subname owner on registration. Registry-specific,
   * so it is configuration rather than a constant we guess.
   */
  ENS_ROLE_BITMAP?: string;
  /** Seconds a subname is registered for. Default one year. */
  ENS_SUBNAME_TTL?: string;
}

/** Minimal ABI — only what we call, so a registry upgrade fails loudly. */
export const REGISTRY_ABI = [
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [
      { name: "label", type: "string" },
      { name: "owner", type: "address" },
      { name: "registry", type: "address" },
      { name: "resolver", type: "address" },
      { name: "roleBitmap", type: "uint256" },
      { name: "expiry", type: "uint64" },
    ],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
  {
    type: "function",
    name: "getStatus",
    stateMutability: "view",
    inputs: [{ name: "anyId", type: "uint256" }],
    outputs: [{ name: "status", type: "uint8" }],
  },
  {
    type: "function",
    name: "getTokenId",
    stateMutability: "view",
    inputs: [{ name: "anyId", type: "uint256" }],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
  {
    type: "function",
    name: "setResolver",
    stateMutability: "nonpayable",
    inputs: [
      { name: "anyId", type: "uint256" },
      { name: "resolver", type: "address" },
    ],
    outputs: [],
  },
] as const;

/** ENSIP-5 setText, on the resolver. */
export const RESOLVER_ABI = [
  {
    type: "function",
    name: "setText",
    stateMutability: "nonpayable",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "key", type: "string" },
      { name: "value", type: "string" },
    ],
    outputs: [],
  },
] as const;

/** IPermissionedRegistry.Status */
export const STATUS = { AVAILABLE: 0, RESERVED: 1, REGISTERED: 2 } as const;

const ONE_YEAR = 365 * 24 * 60 * 60;

export const registrarConfigured = (env: RegistrarEnv): boolean =>
  Boolean(
    env.ENS_REGISTRY_ADDRESS &&
      env.ENS_RESOLVER_ADDRESS &&
      env.ENS_REGISTRAR_KEY &&
      env.ENS_REGISTRY_RPC
  );

/** Lazily built so a missing/incompatible viem cannot break session startup. */
async function clients(env: RegistrarEnv) {
  const { createPublicClient, createWalletClient, http, defineChain } = await import("viem");
  const { privateKeyToAccount } = await import("viem/accounts");

  const id = Number(env.ENS_REGISTRY_CHAIN_ID ?? 84532);
  const chain = defineChain({
    id,
    name: `chain-${id}`,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [env.ENS_REGISTRY_RPC!] } },
  });

  const key = env.ENS_REGISTRAR_KEY!.startsWith("0x")
    ? (env.ENS_REGISTRAR_KEY as `0x${string}`)
    : (`0x${env.ENS_REGISTRAR_KEY}` as `0x${string}`);

  const account = privateKeyToAccount(key);
  return {
    account,
    publicClient: createPublicClient({ chain, transport: http(env.ENS_REGISTRY_RPC) }),
    walletClient: createWalletClient({ account, chain, transport: http(env.ENS_REGISTRY_RPC) }),
  };
}

export interface RegisterResult {
  label: string;
  /** Present only when a transaction actually confirmed. */
  txHash?: string;
  /** True when the label was already registered — not an error, and not a mint. */
  alreadyRegistered?: boolean;
  error?: string;
}

/**
 * Register one subname under our parent.
 *
 * `owner` is the registrar itself by default. Our humans are verified by World
 * and never connect a wallet — the zero-hex doctrine means we don't ask for an
 * address — so there is no user key to own the name yet. The name is held for
 * them and is transferable the moment a contributor supplies an address, which
 * is the same shape as the payout design: custody deferred, never assumed.
 */
export async function registerSubname(
  env: RegistrarEnv,
  label: string,
  owner?: string
): Promise<RegisterResult> {
  if (!registrarConfigured(env)) {
    return { label, error: "ENS registrar not configured" };
  }

  try {
    const { labelhash } = await import("viem");
    const { account, publicClient, walletClient } = await clients(env);
    const registry = env.ENS_REGISTRY_ADDRESS as `0x${string}`;
    const id = BigInt(labelhash(label));

    // Idempotent by design: sessions replay, retries happen, and a second mint
    // of the same label would revert the whole batch.
    const status = await publicClient.readContract({
      address: registry,
      abi: REGISTRY_ABI,
      functionName: "getStatus",
      args: [id],
    });
    if (Number(status) === STATUS.REGISTERED) {
      return { label, alreadyRegistered: true };
    }

    const expiry = BigInt(Math.floor(Date.now() / 1000) + Number(env.ENS_SUBNAME_TTL ?? ONE_YEAR));

    const hash = await walletClient.writeContract({
      address: registry,
      abi: REGISTRY_ABI,
      functionName: "register",
      args: [
        label,
        (owner ?? account.address) as `0x${string}`,
        // No subregistry: these are leaf names, not further namespaces.
        "0x0000000000000000000000000000000000000000",
        env.ENS_RESOLVER_ADDRESS as `0x${string}`,
        BigInt(env.ENS_ROLE_BITMAP ?? 0),
        expiry,
      ],
    });

    // Only a mined transaction counts as registered.
    await publicClient.waitForTransactionReceipt({ hash });
    return { label, txHash: hash };
  } catch (err) {
    return { label, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Write text records onto a name — this is where the ENSIP-26 endpoints and the
 * ENSIP-25 registry link actually land, and therefore where "resolve the name to
 * reach the agent" stops being a description and becomes true.
 *
 * Records are written one at a time on purpose: a partial write is recoverable
 * and reportable, whereas a multicall that reverts leaves us unable to say which
 * records exist.
 */
export async function writeTextRecords(
  env: RegistrarEnv,
  name: string,
  records: Record<string, string>
): Promise<{ written: string[]; failed: Record<string, string> }> {
  const written: string[] = [];
  const failed: Record<string, string> = {};

  if (!registrarConfigured(env)) {
    for (const key of Object.keys(records)) failed[key] = "ENS registrar not configured";
    return { written, failed };
  }

  const { namehash } = await import("viem");
  const { publicClient, walletClient } = await clients(env);
  const node = namehash(name);
  const resolver = env.ENS_RESOLVER_ADDRESS as `0x${string}`;

  for (const [key, value] of Object.entries(records)) {
    if (!value) continue; // never publish an empty record
    try {
      const hash = await walletClient.writeContract({
        address: resolver,
        abi: RESOLVER_ABI,
        functionName: "setText",
        args: [node, key, value],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      written.push(key);
    } catch (err) {
      failed[key] = err instanceof Error ? err.message : String(err);
    }
  }

  return { written, failed };
}
