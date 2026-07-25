/**
 * Worker -> chain sidecar client for Hedera WRITES (hedera-spec §2.1).
 *
 * Reads do not come through here: they go straight to Mirror Node from the
 * Worker (see mirror.ts), which is what makes "the ticker renders from the
 * network" a fact rather than a slogan.
 */

import type { MassEvent } from "../core/types.js";

export interface HederaEnv {
  ZG_STORAGE_SERVICE_URL?: string;
  STORAGE_AUTH_TOKEN?: string;
  HEDERA_TOPIC_ID?: string;
  HEDERA_OPERATOR_ID?: string;
  HEDERA_COMPUTE_ACCOUNT_ID?: string;
  HEDERA_CAPTABLE_TOKEN_ID?: string;
}

export class HederaUnconfigured extends Error {
  constructor() {
    super("Hedera not configured (sidecar URL or topic id missing)");
    this.name = "HederaUnconfigured";
  }
}

export const hederaEnabled = (env: HederaEnv) =>
  Boolean(env.ZG_STORAGE_SERVICE_URL && env.HEDERA_TOPIC_ID);

async function call<T>(env: HederaEnv, op: string, body: unknown): Promise<T> {
  if (!env.ZG_STORAGE_SERVICE_URL) throw new HederaUnconfigured();

  const res = await fetch(
    `${env.ZG_STORAGE_SERVICE_URL.replace(/\/$/, "")}/hedera/${op}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.STORAGE_AUTH_TOKEN ?? ""}`,
      },
      body: JSON.stringify(body ?? {}),
    }
  );

  if (!res.ok) {
    throw new Error(`hedera/${op} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return res.json<T>();
}

/** Events worth anchoring — hedera-spec §4.2. Conversation is NOT provenance. */
const ANCHORED = new Set([
  "seat.claimed",
  "contrib.cosigned",
  "contrib.accepted",
  "brain.updated",
  "payment.executed",
  "job.settled",
  "captable.minted",
  "payout",
]);

export const shouldAnchor = (type: string) => ANCHORED.has(type);

export const createTopic = (env: HederaEnv, memo?: string) =>
  call<{ topicId: string; txId: string }>(env, "create-topic", { memo });

/**
 * Submits the hash-only projection. The sidecar rebuilds the projection itself
 * rather than trusting whatever we send, so content cannot reach HCS even if a
 * caller here passes a full event by mistake (§4.1).
 */
/**
 * Correlation keys that may be published. Explicitly whitelisted, and read from
 * known payload fields rather than spread — the alternative is discovering that
 * a new payload field went public because nobody remembered to exclude it.
 */
function publicRefs(event: MassEvent): Record<string, string | undefined> {
  const p = (event.payload ?? {}) as Record<string, unknown>;
  const pick = (k: string) => (typeof p[k] === "string" ? (p[k] as string) : undefined);
  return {
    contribId: pick("contribId"),
    storageRootHash: pick("storageRootHash"),
    hederaTxId: pick("hederaTxId"),
    // contrib.accepted is emitted BY THE SYSTEM, so actor.seat is empty — yet
    // it is the one event the cap table counts. The credited seat lives in its
    // payload, and without publishing it the cap table stays underivable.
    seat: pick("seat"),
    /**
     * A stable, opaque handle for the VERIFIED HUMAN behind a seat: a truncated
     * hash of their World nullifier.
     *
     * A seat id is random and per-session, so the public log could show that
     * "some seat" earned a share but never that the same person earned two, or
     * that two seats are one human. Ownership has to key to something that
     * identifies a unique human and cannot be edited by its owner. The value is
     * hashed and truncated so it correlates within our topic without becoming a
     * cross-app identifier for that person.
     */
    humanRef: pick("humanRef"),
  };
}

export const anchorEvent = (env: HederaEnv, event: MassEvent) =>
  call<{ txId: string; sequenceNumber: string | null }>(env, "submit-event", {
    topicId: env.HEDERA_TOPIC_ID,
    event: {
      id: event.id,
      ts: event.ts,
      type: event.type,
      actor: event.actor,
      ref: publicRefs(event),
      payloadHash: event.payloadHash,
    },
  });

export const payForInference = (
  env: HederaEnv,
  args: { to: string; amountHbar: number; requestHash: string }
) => call<{ txId: string; amountHbar: number }>(env, "pay-inference", args);

export const payoutSplit = (
  env: HederaEnv,
  args: { transfers: { accountId: string; amountTinybar: string }[]; memo?: string }
) => call<{ txId: string; totalTinybar: string }>(env, "payout-split", args);

export const createAccount = (env: HederaEnv, initialHbar = 1) =>
  call<{ accountId: string; privateKey: string; txId: string }>(env, "create-account", {
    initialHbar,
  });

export const createCapTableToken = (env: HederaEnv) =>
  call<{ tokenId: string; txId: string; fee: string }>(env, "create-captable-token", {});

export const mintCapTable = (
  env: HederaEnv,
  args: {
    tokenId: string;
    allocations: { accountId?: string; privateKey?: string; units: number }[];
  }
) =>
  call<{ tokenId: string; mintTxId: string; totalUnits: number }>(
    env,
    "mint-captable",
    args
  );

export const announceIdentity = (env: HederaEnv, meta: Record<string, unknown>) =>
  call<{ txId: string }>(env, "announce-identity", {
    topicId: env.HEDERA_TOPIC_ID,
    meta,
  });
