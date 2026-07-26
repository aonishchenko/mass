/**
 * SETTLEMENT — what each human would be paid for one job, and why.
 *
 * Deliberately **computed, never executed**. No transfer is made this weekend:
 * the agent is not live on a marketplace, nobody has linked a payout account,
 * and money that moves before either of those is true is theatre. What this
 * does produce is a statement precise enough to be paid from the moment those
 * are true — and honest enough to show a judge in the meantime.
 *
 * The rule (decided, and now the only one in the codebase):
 *
 *   70%  follows USE      — whose knowledge this job actually drew on
 *   30%  follows OWNERSHIP — everyone's share of what the agent has been taught
 *
 * Use is measured, not asserted: see core/attribution.ts. Ownership is the
 * cap-table fold. Both are recomputable by anyone replaying the Hedera topic.
 */

import { splitPayment, type SplitResult } from "../hedera/split.js";
import { FLOOR, type UsageLine } from "./attribution.js";

export interface SettlementInput {
  /** What the job paid, in tinybar. */
  amountTinybar: bigint;
  /** Per-seat usage weight for this job (attribution.usageBySeat). */
  usage: Record<string, number>;
  /** seat -> accepted contributions (reduce.capTable). */
  capTable: Record<string, number>;
  /** seat -> display/ENS name, for a statement a human can read. */
  names: Record<string, string>;
  /**
   * seat -> Hedera account, when a contributor has linked one. Absent for
   * everyone today; a share with no account is *held*, not lost.
   */
  accounts?: Record<string, string | undefined>;
}

export interface SettlementLine {
  seat: string;
  name: string;
  /** Their cut, in tinybar. */
  amountTinybar: bigint;
  /** Why: what they earned from use, and what from ownership. */
  fromUse: bigint;
  fromOwnership: bigint;
  /** Payable now, or waiting for this person to link an account. */
  status: "payable" | "held-no-account" | "held-below-minimum";
}

export interface Settlement {
  amountTinybar: bigint;
  lines: SettlementLine[];
  /** Sum of everything not payable yet. Held, never absorbed by us. */
  heldTinybar: bigint;
  /**
   * Always false for now, and stated rather than implied: this settlement has
   * been CALCULATED. No Hedera transfer has been made.
   */
  executed: false;
  usage: UsageLine[];
}

/** 70 / 30, matching src/hedera/split.ts. Single source of truth for the ratio. */
export const USE_BPS = 7000n;
export const OWNERSHIP_BPS = 3000n;

/**
 * Compute the statement. Pure and integer-only: a payroll that loses tinybar to
 * floating point cannot be reconciled, and reconciliation is the claim.
 */
export function settle(input: SettlementInput, usageDetail: UsageLine[] = []): Settlement {
  // Reuse the tested splitter for the actual arithmetic. It already guarantees
  // the parts sum EXACTLY to the whole and gives any rounding remainder to the
  // largest share.
  const split: SplitResult = splitPayment({
    amountTinybar: input.amountTinybar,
    usage: input.usage,
    capTable: input.capTable,
    accounts: input.accounts ?? {},
  });

  // Every number below comes from that one distribution. Recomputing the two
  // pots here with independent divisions lost the rounding remainder — and,
  // when a job cited nothing, lost the entire 70% use pot, because the splitter
  // folds it into ownership and this did not. A statement that does not add up
  // to the job it describes is worse than no statement.
  const lines: SettlementLine[] = [];
  let held = 0n;

  for (const [seat, share] of Object.entries(split.shares)) {
    if (share.total <= 0n) continue;

    const paid = split.transfers.find((t) => t.seat === seat);
    const hasAccount = Boolean(input.accounts?.[seat]);
    const status: SettlementLine["status"] = paid
      ? "payable"
      : hasAccount
        ? "held-below-minimum"
        : "held-no-account";
    if (!paid) held += share.total;

    lines.push({
      seat,
      name: input.names[seat] ?? seat,
      amountTinybar: share.total,
      fromUse: share.fromUse,
      fromOwnership: share.fromOwnership,
      status,
    });
  }

  lines.sort((a, b) => (b.amountTinybar > a.amountTinybar ? 1 : -1));

  return {
    amountTinybar: input.amountTinybar,
    lines,
    heldTinybar: held,
    executed: false,
    usage: usageDetail,
  };
}

/** Tinybar -> a readable ℏ string. Display only; never used for arithmetic. */
export const toHbar = (tinybar: bigint) => (Number(tinybar) / 100_000_000).toFixed(4);


// ---------------------------------------------------------------------------
// Building a statement from a session
// ---------------------------------------------------------------------------

/**
 * What one job costs. A marketplace listing needs a price, and so does a
 * settlement — you cannot split an amount you never quoted.
 *
 * Held here as the single source of truth so the rate card published on ENS,
 * the agent card, and the settlement all quote the same number.
 */
export const RATE_CARD = {
  service: "Review one documentation page",
  priceTinybar: 100_000_000n, // 1 HBAR
  turnaround: "under 2 minutes",
} as const;

export const rateCardLine = () =>
  `${RATE_CARD.service} — ${toHbar(RATE_CARD.priceTinybar)} HBAR, ${RATE_CARD.turnaround}`;

/**
 * Build the settlement for the agent's most recent job, from the log alone.
 *
 * Usage comes from the chunk ids that job's answer actually cited (validated
 * server-side at inference time); ownership from the cap-table fold. Returns
 * undefined when the agent has not done a job yet — there is nothing to split.
 */
export function settlementForLastJob(session: {
  events: { type: string; payload?: unknown }[];
  seats: Record<string, { name: string; ensName?: string }>;
  brainChunks?: { chunkId: string; contributor: string }[];
  contributions?: Record<string, { contribId: string; state: string }>;
}, capTable: Record<string, number>, seatOfChunk: Record<string, string>) {
  const jobs = session.events.filter((e) => e.type === "canonical.completed");
  const last = jobs[jobs.length - 1];
  if (!last) return undefined;

  const p = last.payload as { usedChunkIds?: string[]; candidateChunkIds?: string[] };
  const used = new Set(p?.usedChunkIds ?? []);
  // Everything the model could see, not only what it quoted. A small model
  // under-cites, and a contributor whose knowledge was in front of it should
  // not be zeroed out by the model forgetting to name them — they earn FLOOR
  // rather than nothing (core/attribution.ts). Older jobs recorded no candidate
  // set, so they fall back to the cited ids alone.
  const candidates = p?.candidateChunkIds?.length ? p.candidateChunkIds : [...used];

  const usage: Record<string, number> = {};
  for (const chunkId of candidates) {
    const seat = seatOfChunk[chunkId];
    if (!seat) continue;
    usage[seat] = (usage[seat] ?? 0) + (used.has(chunkId) ? 1 : FLOOR);
  }

  const names: Record<string, string> = {};
  for (const [seatId, seat] of Object.entries(session.seats)) {
    names[seatId] = seat.ensName ?? seat.name;
  }

  // The per-chunk working, so a contributor can check the split rather than
  // take it on faith — which is the whole reason the number is computed from
  // the log in the first place.
  const contributorOf = new Map((session.brainChunks ?? []).map((c) => [c.chunkId, c.contributor]));
  const detail: UsageLine[] = candidates
    .filter((chunkId) => seatOfChunk[chunkId])
    .map((chunkId) => ({
      chunkId,
      seat: seatOfChunk[chunkId],
      contributor: contributorOf.get(chunkId) ?? seatOfChunk[chunkId],
      cited: used.has(chunkId),
      weight: used.has(chunkId) ? 1 : FLOOR,
    }));

  return settle(
    {
      amountTinybar: RATE_CARD.priceTinybar,
      usage,
      capTable,
      names,
    },
    detail
  );
}
