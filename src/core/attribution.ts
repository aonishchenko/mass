/**
 * ATTRIBUTION — which knowledge the agent actually used to produce an answer.
 *
 * This is the number money depends on, so it is built to be *provable* rather
 * than trusted.
 *
 * The problem: asking a model to name its sources in prose gives you a claim.
 * It can cite a contributor who does not exist, cite a number it invented, or
 * use a chunk and mention nobody. None of that is safe to pay against.
 *
 * The solution rests on one fact: WE build the prompt, so we always know the
 * exact set of chunks the model could possibly have seen — the candidate set.
 * Attribution is therefore constrained to a subset of that set:
 *
 *   1. Each chunk enters the prompt tagged with an opaque marker `[[c_ab12]]`.
 *   2. The model is told to repeat the marker of anything it uses.
 *   3. Every marker it returns is CHECKED AGAINST THE CANDIDATE SET.
 *      Anything not offered to it is discarded — a hallucinated citation can
 *      never earn money, structurally.
 *
 * Under-citation is handled by weighting rather than by trusting the model:
 * chunks it explicitly cited earn full weight; chunks that were retrieved but
 * not cited earn a small floor, because they were in front of it and may well
 * have shaped the answer. See `usageWeights`.
 */

import type { BrainChunk } from "./types.js";

/**
 * Marker written beside each chunk in the prompt and echoed back by the model.
 *
 * Deliberately opaque and id-based, not name-based. Display names change, two
 * people can pick the same one, and "(per alice's contribution #7)" is
 * ambiguous the moment there are two Alices — but a chunk id is exact.
 */
export const markerFor = (chunkId: string) => `[[${chunkId}]]`;

const MARKER = /\[\[([A-Za-z0-9_-]{3,64})\]\]/g;

/**
 * Chunk ids the answer claims to have used, restricted to ids that were
 * genuinely offered. Returns them in first-appearance order, deduplicated.
 */
export function citedChunkIds(answer: string, candidates: BrainChunk[]): string[] {
  const offered = new Set(candidates.map((c) => c.chunkId));
  const seen = new Set<string>();
  const out: string[] = [];

  for (const m of answer.matchAll(MARKER)) {
    const id = m[1];
    // The check that makes this trustworthy: an id we never showed the model
    // cannot be something the model used.
    if (offered.has(id) && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/** Markers are plumbing; a reader should never see them. */
export const stripMarkers = (answer: string) => answer.replace(MARKER, "").replace(/[ \t]{2,}/g, " ");

/**
 * How much of the usage pot each chunk earned for this answer.
 *
 * Hybrid by decision: a cited chunk earns `1`, a chunk that was retrieved but
 * not cited earns `FLOOR`. Small models under-cite, and a contributor whose
 * knowledge was in front of the model should not be zeroed out by the model's
 * forgetfulness — but they should earn visibly less than one that was quoted.
 *
 * With nothing cited at all, every retrieved chunk shares the pot equally: the
 * answer came from somewhere, and that somewhere is the retrieved set.
 */
export const FLOOR = 0.15;

export function usageWeights(
  answer: string,
  candidates: BrainChunk[]
): Record<string, number> {
  const cited = new Set(citedChunkIds(answer, candidates));
  const weights: Record<string, number> = {};
  for (const c of candidates) {
    weights[c.chunkId] = cited.has(c.chunkId) ? 1 : FLOOR;
  }
  return weights;
}

/** Per-seat usage weight for one answer, for the payout split. */
export function usageBySeat(
  answer: string,
  candidates: BrainChunk[],
  /** chunkId -> the seat credited with it (contrib.accepted). */
  seatOf: Record<string, string>
): Record<string, number> {
  const perChunk = usageWeights(answer, candidates);
  const out: Record<string, number> = {};
  for (const [chunkId, w] of Object.entries(perChunk)) {
    const seat = seatOf[chunkId];
    if (!seat) continue; // a chunk with no credited seat earns nobody anything
    out[seat] = (out[seat] ?? 0) + w;
  }
  return out;
}

/**
 * A human-readable account of why each chunk earned what it did. Shown in the
 * settlement statement so a contributor can check the maths rather than trust
 * it.
 */
export interface UsageLine {
  chunkId: string;
  seat: string;
  contributor: string;
  cited: boolean;
  weight: number;
}

export function usageLines(
  answer: string,
  candidates: BrainChunk[],
  seatOf: Record<string, string>
): UsageLine[] {
  const cited = new Set(citedChunkIds(answer, candidates));
  return candidates.map((c) => ({
    chunkId: c.chunkId,
    seat: seatOf[c.chunkId] ?? "",
    contributor: c.contributor,
    cited: cited.has(c.chunkId),
    weight: cited.has(c.chunkId) ? 1 : FLOOR,
  }));
}
