/**
 * 0G Storage — the brain and the archive (§8.1, §8.2).
 *
 * Two artifacts, both encrypted client-side:
 *   archive — full event log, automatic, nobody decides
 *   brain   — accepted chunks only, humans decide
 *
 * The SDK's `./browser` entry is the Workers-safe build (pure @noble crypto, no
 * fs). The Node entry pulls in file/merkle helpers we do not use.
 */

import { encrypt } from "./crypto.js";
import { installFetchAdapter } from "./axios-fetch-adapter.js";
import type { BrainChunk, BrainDoc, MassEvent } from "../core/types.js";

export interface StorageEnv {
  ZG_STORAGE_RPC: string;
  ZG_STORAGE_INDEXER: string;
  ZG_PRIVATE_KEY?: string;
  SESSION_KEY?: string;
  /**
   * Sidecar base URL (services/zg-storage). REQUIRED in production: 0G storage
   * nodes listen on http://<ip>:5678 and Cloudflare Workers cannot open
   * outbound connections on port 5678. Unset falls back to the in-Worker SDK
   * path, which only works under Miniflare locally.
   */
  ZG_STORAGE_SERVICE_URL?: string;
  STORAGE_AUTH_TOKEN?: string;
}

export class StorageUnconfigured extends Error {
  constructor() {
    super("0G storage not configured (ZG_PRIVATE_KEY / SESSION_KEY missing)");
    this.name = "StorageUnconfigured";
  }
}

/**
 * 0G testnet storage nodes sometimes stall in "waiting for storage node to
 * sync" indefinitely. The brain write runs on a serialized queue, so one hung
 * upload would block every later write. Cap it and let the retry-on-next-
 * acceptance path handle it (§10).
 */
const UPLOAD_TIMEOUT_MS = 90_000;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

async function upload(env: StorageEnv, bytes: Uint8Array): Promise<string> {
  if (!env.SESSION_KEY) throw new StorageUnconfigured();

  if (env.ZG_STORAGE_SERVICE_URL) {
    const res = await withTimeout(
      fetch(`${env.ZG_STORAGE_SERVICE_URL.replace(/\/$/, "")}/upload`, {
        method: "POST",
        headers: {
          "content-type": "application/octet-stream",
          authorization: `Bearer ${env.STORAGE_AUTH_TOKEN ?? ""}`,
        },
        body: bytes,
      }),
      UPLOAD_TIMEOUT_MS,
      "storage sidecar upload"
    );
    if (!res.ok) throw new Error(`storage sidecar ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const { rootHash } = await res.json<{ rootHash: string }>();
    if (!rootHash) throw new Error("sidecar returned no rootHash");
    return rootHash;
  }

  if (!env.ZG_PRIVATE_KEY) throw new StorageUnconfigured();

  // MUST run before the SDK is imported: its axios 0.27 picks an adapter at
  // import time and neither choice exists in Workers. See axios-fetch-adapter.ts.
  await installFetchAdapter();

  // Imported lazily so a missing/incompatible SDK cannot break session startup —
  // the failure surfaces on the write path, where it is handled (§10).
  const { Indexer, MemData } = await import("@0gfoundation/0g-storage-ts-sdk");
  const { ethers } = await import("ethers");

  const provider = new ethers.JsonRpcProvider(env.ZG_STORAGE_RPC);
  const signer = new ethers.Wallet(env.ZG_PRIVATE_KEY, provider);
  const indexer = new Indexer(env.ZG_STORAGE_INDEXER);

  const [tx, err] = await withTimeout(
    indexer.upload(new MemData(bytes), env.ZG_STORAGE_RPC, signer),
    UPLOAD_TIMEOUT_MS,
    "0G storage upload"
  );
  if (err) throw err;

  // upload() returns either a single result or a batch one depending on input.
  const rootHash = "rootHash" in tx ? tx.rootHash : tx.rootHashes?.[0];
  if (!rootHash) throw new Error("upload returned no rootHash");
  return rootHash;
}

/**
 * Hash-links every brain version through `prevRoot`, giving a verifiable brain
 * history from 0G Storage alone — before Hedera is wired (§8.2).
 */
export async function writeBrain(
  env: StorageEnv,
  chunks: BrainChunk[],
  prevRoot?: string
): Promise<string> {
  const doc: BrainDoc = { v: 1, prevRoot, chunks, ts: Date.now() };
  const bytes = await encrypt(JSON.stringify(doc), env.SESSION_KEY ?? "");
  return upload(env, bytes);
}

/** Full transcript. No human decides what goes in here (§8.1). */
export async function writeArchive(env: StorageEnv, events: MassEvent[]): Promise<string> {
  const bytes = await encrypt(JSON.stringify({ v: 1, events }), env.SESSION_KEY ?? "");
  return upload(env, bytes);
}

/**
 * Encrypted blobs need downloadToBlob(), NOT download() — see §8.2.
 */
export async function readBlob(env: StorageEnv, rootHash: string): Promise<Uint8Array> {
  if (env.ZG_STORAGE_SERVICE_URL) {
    const base = env.ZG_STORAGE_SERVICE_URL.replace(/\/$/, "");
    const res = await fetch(`${base}/download?root=${encodeURIComponent(rootHash)}`, {
      headers: { authorization: `Bearer ${env.STORAGE_AUTH_TOKEN ?? ""}` },
    });
    if (!res.ok) throw new Error(`storage sidecar ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  }

  await installFetchAdapter();
  const { Indexer } = await import("@0gfoundation/0g-storage-ts-sdk");
  const indexer = new Indexer(env.ZG_STORAGE_INDEXER);
  const [blob, err] = await indexer.downloadToBlob(rootHash);
  if (err) throw err;
  return new Uint8Array(await blob.arrayBuffer());
}
