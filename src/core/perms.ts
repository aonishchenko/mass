/**
 * Authority engine — MASS-specs.md A4.
 *
 * Pure function of who is verified AND present. No I/O, no clock, no randomness:
 * it is called during replay (shared-session-spec §4.2).
 */

import type { IntentKind, Seat, Session, Tier } from "./types.js";

export interface Perms {
  /** DRAFT lane: >=1 T2 present. */
  canDraft: boolean;
  /** COMMIT actions: 2 T3 co-signs available. */
  canCommit: boolean;
  presentT2: number;
  presentT3: number;
  /**
   * Last T3 left mid-flight: finish what is in progress, then lock.
   * No new COMMIT may start.
   */
  locked: boolean;
}

/** T2 counts as "at least builder", T3 as "at least signer". */
const rank: Record<Tier, number> = { T1: 0, T2: 1, T3: 2 };

export const atLeast = (tier: Tier, min: Tier): boolean =>
  rank[tier] >= rank[min];

export function computePerms(crew: Seat[]): Perms {
  const present = crew.filter((s) => s.present);
  const presentT2 = present.filter((s) => atLeast(s.tier, "T2")).length;
  const presentT3 = present.filter((s) => s.tier === "T3").length;

  return {
    canDraft: presentT2 >= 1,
    canCommit: presentT3 >= 2,
    presentT2,
    presentT3,
    locked: presentT3 < 2,
  };
}

/** Minimum tier required to even submit each intent. */
const MIN_TIER: Record<IntentKind, Tier> = {
  claimSeat: "T1",
  resumeSeat: "T1",
  nameSession: "T2",
  /** Must already be a verified Builder before delegating as a Signer. */
  delegate: "T2",
  instruct: "T2",
  proposeContrib: "T2",
  challengeContrib: "T2",
  cosign: "T3",
  openHarvest: "T2",
  keepCandidate: "T2",
  cosignBatch: "T3",
  cancelHarvest: "T2",
  closeSession: "T3",
};

export interface Denial {
  ok: false;
  reason: string;
}
export type Authorization = { ok: true } | Denial;

/**
 * Gate an intent against live authority. The lane matters: a T2 must be
 * structurally unable to trigger a canonical run (shared-session-spec §6.1).
 */
export function authorize(
  kind: IntentKind,
  seat: Seat | null,
  s: Session,
  opts: { lane?: string } = {}
): Authorization {
  if (s.closed) return { ok: false, reason: "session is closed" };

  if (kind === "claimSeat" || kind === "resumeSeat") return { ok: true };
  if (!seat) return { ok: false, reason: "no seat claimed" };

  if (!atLeast(seat.tier, MIN_TIER[kind])) {
    return { ok: false, reason: `${kind} requires ${MIN_TIER[kind]}` };
  }

  const perms = computePerms(Object.values(s.seats));

  if (kind === "instruct") {
    if (!perms.canDraft) {
      return { ok: false, reason: "DRAFT needs >=1 verified builder present" };
    }
    if (opts.lane === "canonical" && !perms.canCommit) {
      return { ok: false, reason: "CANONICAL needs 2 signers present" };
    }
    return { ok: true };
  }

  if (kind === "cosign" || kind === "cosignBatch" || kind === "closeSession") {
    if (perms.locked) {
      return { ok: false, reason: "COMMIT locked: fewer than 2 signers present" };
    }
  }

  // §7.5.5 — the cap-table fold must not race an unfinished review.
  if (kind === "closeSession" && s.harvest?.open) {
    return { ok: false, reason: "close a harvest before closing the session" };
  }

  if (kind === "openHarvest" && s.harvest?.open) {
    return { ok: false, reason: "a harvest is already open" };
  }

  if (
    (kind === "keepCandidate" || kind === "cosignBatch" || kind === "cancelHarvest") &&
    !s.harvest?.open
  ) {
    return { ok: false, reason: "no harvest is open" };
  }

  return { ok: true };
}
