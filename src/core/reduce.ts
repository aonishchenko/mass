/**
 * The fold. `state = events.reduce(apply, EMPTY_SESSION)` — shared-session-spec §4.
 *
 * HARD RULE (§4.2): apply() is deterministic. No Date.now(), no randomUUID(), no
 * network, no storage. Time comes from `e.ts`, ids come from the payload. If two
 * tabs ever diverge, the bug is an impurity in here.
 */

import type {
  AgentKitOkPayload,
  ArchiveWrittenPayload,
  BrainUpdatedPayload,
  ContribAcceptedPayload,
  ContribChallengedPayload,
  ContribCosignedPayload,
  ContribProposedPayload,
  ContribScreenedPayload,
  ContinuityOkPayload,
  HarvestCancelledPayload,
  HarvestClosedPayload,
  HarvestOpenedPayload,
  MassEvent,
  SeatClaimedPayload,
  SelfieOkPayload,
  Session,
} from "./types.js";

export function apply(s: Session, e: MassEvent): Session {
  switch (e.type) {
    case "session.created":
      return { ...s, created: true };

    case "seat.claimed": {
      const p = e.payload as SeatClaimedPayload;
      return {
        ...s,
        seats: {
          ...s.seats,
          [p.seat]: { seat: p.seat, name: p.name, tier: p.tier, present: true },
        },
      };
    }

    case "seat.left": {
      const p = e.payload as { seat: string };
      const seat = s.seats[p.seat];
      if (!seat) return s;
      return {
        ...s,
        seats: { ...s.seats, [p.seat]: { ...seat, present: false } },
      };
    }

    case "seat.rejoined": {
      const p = e.payload as { seat: string };
      const seat = s.seats[p.seat];
      if (!seat) return s;
      return { ...s, seats: { ...s.seats, [p.seat]: { ...seat, present: true } } };
    }

    case "verify.selfie.ok": {
      const p = e.payload as SelfieOkPayload;
      const seat = s.seats[p.seat];
      if (!seat) return s;
      // grantedTier, not a hardcoded T2: a sybil score below threshold keeps the
      // seat an Observer (T1) — verified human, but not trusted to earn equity.
      return {
        ...s,
        seats: {
          ...s.seats,
          [p.seat]: {
            ...seat,
            tier: p.grantedTier,
            sybilScore: p.sybilScore,
            nullifierHash: p.nullifierHash,
            verifiedAt: e.ts,
          },
        },
      };
    }

    case "verify.agentkit.ok": {
      const p = e.payload as AgentKitOkPayload;
      const seat = s.seats[p.seat];
      if (!seat) return s;
      return {
        ...s,
        seats: {
          ...s.seats,
          [p.seat]: { ...seat, tier: "T3", proofRef: p.proofRef, verifiedAt: e.ts },
        },
      };
    }

    case "verify.continuity.ok": {
      // Continuity re-verification (§B2.5): stamp the seat so an equity share
      // cannot be claimed from an unattended device. covers[] is the batch case.
      const p = e.payload as ContinuityOkPayload;
      const seat = s.seats[p.seat];
      if (!seat) return s;
      return {
        ...s,
        seats: { ...s.seats, [p.seat]: { ...seat, lastContinuityAt: e.ts } },
      };
    }

    case "contrib.proposed": {
      const p = e.payload as ContribProposedPayload;
      const actorSeat = "seat" in e.actor ? e.actor.seat : "system";
      return {
        ...s,
        contributions: {
          ...s.contributions,
          [p.contribId]: {
            contribId: p.contribId,
            text: p.text,
            source: p.source,
            proposedBy: actorSeat,
            state: "proposed",
            cosigners: [],
            screened: false,
            harvestId: p.harvestId,
          },
        },
      };
    }

    case "contrib.challenged": {
      const p = e.payload as ContribChallengedPayload;
      const c = s.contributions[p.contribId];
      if (!c) return s;
      return {
        ...s,
        contributions: {
          ...s.contributions,
          [p.contribId]: { ...c, state: "challenged" },
        },
      };
    }

    case "contrib.screened": {
      const p = e.payload as ContribScreenedPayload;
      const c = s.contributions[p.contribId];
      if (!c) return s;
      return {
        ...s,
        contributions: {
          ...s.contributions,
          [p.contribId]: {
            ...c,
            screened: p.verdict === "pass",
            state: p.verdict === "flagged" ? "rejected" : c.state,
          },
        },
      };
    }

    case "contrib.cosigned": {
      const p = e.payload as ContribCosignedPayload;
      const c = s.contributions[p.contribId];
      if (!c || c.cosigners.includes(p.seat)) return s;
      return {
        ...s,
        contributions: {
          ...s.contributions,
          [p.contribId]: { ...c, cosigners: [...c.cosigners, p.seat] },
        },
      };
    }

    case "contrib.accepted": {
      const p = e.payload as ContribAcceptedPayload;
      const c = s.contributions[p.contribId];
      if (!c || c.state === "accepted") return s;
      const seatRecord = s.seats[p.seat];
      return {
        ...s,
        contributions: {
          ...s.contributions,
          [p.contribId]: {
            ...c,
            state: "accepted",
            contribNumber: p.contribNumber,
          },
        },
        contribCounts: { ...s.contribCounts, [p.seat]: p.contribNumber },
        brainChunks: [
          ...s.brainChunks,
          {
            chunkId: p.contribId,
            contributor: seatRecord?.name ?? p.seat,
            contribNumber: p.contribNumber,
            content: p.text,
            screened: c.screened,
          },
        ],
      };
    }

    case "brain.updated": {
      const p = e.payload as BrainUpdatedPayload;
      return { ...s, brainRoot: p.storageRootHash };
    }

    case "archive.written": {
      const p = e.payload as ArchiveWrittenPayload;
      return { ...s, archiveRoot: p.storageRootHash };
    }

    case "harvest.opened": {
      const p = e.payload as HarvestOpenedPayload;
      return {
        ...s,
        harvest: {
          harvestId: p.harvestId,
          sinceSeq: p.sinceSeq,
          open: true,
          keptContribIds: [],
        },
      };
    }

    case "harvest.closed": {
      const p = e.payload as HarvestClosedPayload;
      if (!s.harvest) return s;
      return {
        ...s,
        harvest: { ...s.harvest, open: false, keptContribIds: p.kept },
        lastHarvestedSeq: p.lastSeq,
      };
    }

    case "harvest.cancelled": {
      void (e.payload as HarvestCancelledPayload);
      if (!s.harvest) return s;
      // sinceSeq is NOT advanced — nothing is lost to a later harvest (§10).
      return { ...s, harvest: { ...s.harvest, open: false } };
    }

    case "session.closed":
      return { ...s, closed: true };

    // Log-only: instruct, draft.*, canonical.*, perm.recomputed, payment.*,
    // mints, job.*. They are evidence and UI material, not session state.
    default:
      return s;
  }
}

/** Append an event and fold it in one step. */
export function append(s: Session, e: MassEvent): Session {
  const next = apply(s, e);
  return { ...next, events: [...next.events, e] };
}

/** Full replay from an event array. */
export function replay(initial: Session, events: MassEvent[]): Session {
  return events.reduce(append, initial);
}

/**
 * Cap table — MASS-specs.md C1: count of contrib.accepted per seat, nothing else.
 * Derived by folding the log, so a judge folding the HCS topic gets the same
 * numbers (§4.1).
 */
export function capTable(s: Session): Record<string, number> {
  const alloc: Record<string, number> = {};
  for (const e of s.events) {
    if (e.type !== "contrib.accepted") continue;
    const seat = (e.payload as ContribAcceptedPayload).seat;
    alloc[seat] = (alloc[seat] ?? 0) + 1;
  }
  return alloc;
}
