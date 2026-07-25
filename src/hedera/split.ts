/**
 * Payroll split — hedera-spec.md §5.2. The novelty claim.
 *
 * Pure and integer-only on purpose. This decides who gets paid what, so it must
 * be testable against a scripted log without touching the network, and it must
 * not lose or invent tinybars to floating point.
 */

export interface Citation {
  file: string;
  lineStart: number;
  lineEnd: number;
  /** Seat credited with authoring the cited lines. */
  seat: string;
}

export interface SplitInput {
  amountTinybar: bigint;
  /** Citations the job actually drew on — drives the authorship share. */
  citations: Citation[];
  /** seat -> accepted contributions, the cap table (reduce.ts capTable). */
  capTable: Record<string, number>;
  /** seat -> hedera account. A seat without one accrues to the pool. */
  accounts: Record<string, string | undefined>;
  /** Below this, a transfer costs more in fees than it moves (§5.2). */
  dustThresholdTinybar?: bigint;
}

export interface SplitResult {
  transfers: { seat: string; accountId: string; amountTinybar: bigint }[];
  pooledRemainder: bigint;
  /** For the reconciliation check (§5.3). */
  total: bigint;
}

/** 0.1 HBAR. */
export const DEFAULT_DUST = 10_000_000n;

/** 70% follows citations, 30% follows the cap table. */
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

  // Weight authorship by how often the job actually cited each seat.
  const citationWeights: Record<string, number> = {};
  for (const c of input.citations) {
    citationWeights[c.seat] = (citationWeights[c.seat] ?? 0) + 1;
  }

  const authorshipPot = (amount * AUTHORSHIP_BPS) / 10_000n;
  const holderPot = amount - authorshipPot; // remainder stays here, never lost

  // With no citations the authorship pot has no claimants; fold it into the
  // holder pot rather than stranding it.
  const hasCitations = Object.keys(citationWeights).length > 0;
  const authorShares = hasCitations ? distribute(authorshipPot, citationWeights) : {};
  const holderShares = distribute(
    hasCitations ? holderPot : amount,
    input.capTable
  );

  const combined: Record<string, bigint> = {};
  for (const [seat, v] of Object.entries(authorShares)) {
    combined[seat] = (combined[seat] ?? 0n) + v;
  }
  for (const [seat, v] of Object.entries(holderShares)) {
    combined[seat] = (combined[seat] ?? 0n) + v;
  }

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

  return { transfers, pooledRemainder: pooled, total: amount };
}

/**
 * §5.3 — the single most load-bearing check in this module. If this does not
 * balance, the payroll is wrong and the cap-table claim is unsupported.
 */
export function reconciles(r: SplitResult): boolean {
  const paid = r.transfers.reduce((n, t) => n + t.amountTinybar, 0n);
  return paid + r.pooledRemainder === r.total;
}
