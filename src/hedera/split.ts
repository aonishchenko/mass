/**
 * Payroll split — hedera-spec.md §5.2. The novelty claim.
 *
 * Pure and integer-only on purpose. This decides who gets paid what, so it must
 * be testable against a scripted log without touching the network, and it must
 * not lose or invent tinybars to floating point.
 */

export interface SplitInput {
  amountTinybar: bigint;
  /**
   * Per-seat usage weight for THIS job, from core/attribution.ts.
   *
   * Replaces an earlier `Citation[]` of {file, lineStart, lineEnd} — a
   * git-file model that nothing in this codebase could ever produce, because
   * our knowledge units are event-log chunks, not line ranges in files. Usage
   * is now measured against the chunks actually put in front of the model.
   */
  usage: Record<string, number>;
  /** seat -> accepted contributions, the cap table (reduce.ts capTable). */
  capTable: Record<string, number>;
  /** seat -> hedera account. A seat without one accrues to the pool. */
  accounts: Record<string, string | undefined>;
  /** Below this, a transfer costs more in fees than it moves (§5.2). */
  dustThresholdTinybar?: bigint;
}

/** One seat's cut, and which half of the rule each part came from. */
export interface SplitShare {
  fromUse: bigint;
  fromOwnership: bigint;
  total: bigint;
}

export interface SplitResult {
  transfers: { seat: string; accountId: string; amountTinybar: bigint }[];
  /** Per-seat breakdown of the same distribution, exact and reconciling. */
  shares: Record<string, SplitShare>;
  pooledRemainder: bigint;
  /** For the reconciliation check (§5.3). */
  total: bigint;
}

/** 0.1 HBAR. */
export const DEFAULT_DUST = 10_000_000n;

/** 70% follows USE, 30% follows OWNERSHIP. */
export const AUTHORSHIP_BPS = 7000n;
export const HOLDER_BPS = 3000n;

/**
 * Distributes `amount` across `weights` by integer maths, giving any rounding
 * remainder to the largest share. Guarantees the parts sum EXACTLY to the whole:
 * a payroll that loses tinybars to rounding fails reconciliation (§5.3).
 */
function distribute(
  amount: bigint,
  weights: Record<string, number>
): Record<string, bigint> {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  const totalWeight = entries.reduce((n, [, w]) => n + BigInt(w), 0n);
  if (totalWeight === 0n || amount <= 0n) return {};

  const out: Record<string, bigint> = {};
  let assigned = 0n;
  for (const [seat, w] of entries) {
    const share = (amount * BigInt(w)) / totalWeight;
    out[seat] = share;
    assigned += share;
  }

  const remainder = amount - assigned;
  if (remainder > 0n) {
    const biggest = entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
    out[biggest] += remainder;
  }
  return out;
}

export function splitPayment(input: SplitInput): SplitResult {
  const dust = input.dustThresholdTinybar ?? DEFAULT_DUST;
  const amount = input.amountTinybar;

  // Usage arrives already weighted per seat (cited chunks full, retrieved
  // chunks a floor) — see core/attribution.ts. Scaled to integers here because
  // the distribution below is deliberately integer-only.
  const citationWeights: Record<string, number> = {};
  for (const [seat, w] of Object.entries(input.usage)) {
    if (w > 0) citationWeights[seat] = Math.round(w * 1000);
  }

  const authorshipPot = (amount * AUTHORSHIP_BPS) / 10_000n;
  const holderPot = amount - authorshipPot; // remainder stays here, never lost

  // With no usage recorded the use pot has no claimants; fold it into the
  // ownership pot rather than stranding it.
  const hasCitations = Object.keys(citationWeights).length > 0;
  const authorShares = hasCitations ? distribute(authorshipPot, citationWeights) : {};
  const holderShares = distribute(
    hasCitations ? holderPot : amount,
    input.capTable
  );

  const combined: Record<string, bigint> = {};
  // The same numbers, kept split by WHY they were earned. The statement shown
  // to a contributor is built from these rather than recomputed: two
  // independent divisions of the same pot disagree by the rounding remainder,
  // and a payroll whose explanation does not add up to its total is not one
  // anybody should trust.
  const shares: Record<string, SplitShare> = {};
  const credit = (seat: string, amount: bigint, key: "fromUse" | "fromOwnership") => {
    combined[seat] = (combined[seat] ?? 0n) + amount;
    const s = (shares[seat] ??= { fromUse: 0n, fromOwnership: 0n, total: 0n });
    s[key] += amount;
    s.total += amount;
  };
  for (const [seat, v] of Object.entries(authorShares)) credit(seat, v, "fromUse");
  // When nothing was used, the use pot was folded into the ownership pot above,
  // so it is ownership that pays it out — and it is reported as such.
  for (const [seat, v] of Object.entries(holderShares)) credit(seat, v, "fromOwnership");

  const transfers: SplitResult["transfers"] = [];
  let pooled = 0n;

  for (const [seat, amt] of Object.entries(combined)) {
    const accountId = input.accounts[seat];
    // No account, or too small to be worth a transfer — accrue to the pool.
    if (!accountId || amt < dust) {
      pooled += amt;
      continue;
    }
    transfers.push({ seat, accountId, amountTinybar: amt });
  }

  return { transfers, pooledRemainder: pooled, total: amount, shares };
}

/**
 * §5.3 — the single most load-bearing check in this module. If this does not
 * balance, the payroll is wrong and the cap-table claim is unsupported.
 */
export function reconciles(r: SplitResult): boolean {
  const paid = r.transfers.reduce((n, t) => n + t.amountTinybar, 0n);
  return paid + r.pooledRemainder === r.total;
}
