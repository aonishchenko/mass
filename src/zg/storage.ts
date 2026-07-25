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
}

export class StorageUnconfigured extends Error {
  constructor() {
    super("0G storage not configured (ZG_PRIVATE_KEY / SESSION_KEY missing)");
    this.name = "StorageUnconfigured";
  }
}

async function upload(env: StorageEnv, bytes: Uint8Array): Promise<string> {
  if (!env.ZG_PRIVATE_KEY || !env.SESSION_KEY) throw new StorageUnconfigured();

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

  const [tx, err] = await indexer.upload(new MemData(bytes), env.ZG_STORAGE_RPC, signer);
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
  await installFetchAdapter();
  const { Indexer } = await import("@0gfoundation/0g-storage-ts-sdk");
  const indexer = new Indexer(env.ZG_STORAGE_INDEXER);
  const [blob, err] = await indexer.downloadToBlob(rootHash);
  if (err) throw err;
  return new Uint8Array(await blob.arrayBuffer());
}
