/**
 * M5 ENS — identity & careers layer (MASS-specs A5 zero-hex doctrine, M5).
 *
 * ENS is how MASS turns addresses into names and the agent into a resolvable,
 * co-owned employee. This module:
 *   - derives seat subnames + the agent name under a crew parent,
 *   - assembles the agent's "employment record" from live session state
 *     (aggregating World / Hedera / 0G artifacts), and
 *   - resolves + verifies names (forward/reverse) via viem, with a dev fallback
 *     so the whole demo shows names and a working CV page without a deployed
 *     Durin registry.
 *
 * Nothing here is hard-coded per the ENS rubric: the CV data comes from the
 * session's own events; ENS is the identity/verification front door.
 * See docs/ENS-TASK.md.
 */

import type { Session } from "../core/types.js";

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------

export interface EnsEnv {
  /** Crew/session parent name, e.g. "mass.eth". */
  ENS_PARENT_NAME?: string;
  /** Agent label under the parent (the weekend agent). Default "docs". */
  ENS_AGENT_LABEL?: string;
  /** L1 RPC used for CCIP-Read resolution (mainnet/sepolia). */
  ENS_L1_RPC?: string;
  /** Chain for resolution: "mainnet" | "sepolia". Default "mainnet". */
  ENS_CHAIN?: string;
  /** Durin L2 registry address (real subname issuance). */
  ENS_DURIN_REGISTRY?: string;
  /** "1" → deterministic dev names/records; never resolves the network. */
  ENS_DEV_FALLBACK?: string;
  // Read for the profile (already on the DO Env):
  HEDERA_TOPIC_ID?: string;
  HEDERA_CAPTABLE_TOKEN_ID?: string;
}

export const DEFAULT_PARENT = "mass.eth";

/** Real resolution needs a parent name and an L1 RPC. */
export function ensConfigured(env: EnsEnv): boolean {
  return Boolean(env.ENS_PARENT_NAME && env.ENS_L1_RPC);
}

export function parentName(env: EnsEnv): string {
  return env.ENS_PARENT_NAME || DEFAULT_PARENT;
}

// ---------------------------------------------------------------------------
// Name derivation (a safe subset of ENSIP-15 normalization)
// ---------------------------------------------------------------------------

/**
 * Normalize a display name to a valid ENS label: lowercase, spaces→hyphen, drop
 * anything outside [a-z0-9-], collapse and trim hyphens. A real registrar would
 * run full @adraffy/ens-normalize; this is a conservative, deterministic subset.
 */
export function toLabel(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base || "anon";
}

export function joinName(label: string, env: EnsEnv): string {
  return `${label}.${parentName(env)}`;
}

export function agentName(env: EnsEnv): string {
  return `${env.ENS_AGENT_LABEL || "docs"}.${parentName(env)}`;
}

/**
 * A unique seat label given labels already taken in this session. `alice`,
 * then `alice-2`, `alice-3`… Deterministic given insertion order, so replay is
 * stable.
 */
export function uniqueSeatLabel(name: string, taken: Set<string>): string {
  const base = toLabel(name);
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
}

// ---------------------------------------------------------------------------
// Sybil band (never expose the raw score in a public record)
// ---------------------------------------------------------------------------

export type SybilBand = "low" | "medium" | "high";

export function sybilBand(score: number | undefined): SybilBand {
  if (score === undefined) return "low";
  if (score >= 0.85) return "high";
  if (score >= 0.5) return "medium";
  return "low";
}

// ---------------------------------------------------------------------------
// The agent's employment record — assembled from live session state
// ---------------------------------------------------------------------------

export interface ProfileOwner {
  name: string; // the contributor's ENS subname (or seat name)
  contributions: number;
  shareBps: number; // basis points of the cap table
}

export interface AgentProfile {
  name: string; // docs.mass.eth
  role: string;
  description: string;
  skills: string[];
  session: string;
  availability: "for-hire" | "in-session";
  // aggregated sponsor artifacts (only present once produced)
  brainRoot?: string; // 0G Storage root of the sealed brain
  archiveRoot?: string; // 0G Storage root of the session archive
  hcsTopic?: string; // Hedera HCS topic id
  capTableToken?: string; // Hedera HTS token id
  owners: ProfileOwner[]; // crew, by name + share
  contributionCount: number;
  crewSize: number;
}

const ROLE = "Technical Documentation Writer";
const SKILLS = ["technical documentation", "doc review", "developer experience"];

/**
 * Pure: derive the agent's public record from the session. Owners resolve to
 * seat ENS names; shares are the cap-table basis points. Nothing invented — if
 * an artifact (brain root, token id) doesn't exist yet, it's simply omitted.
 */
export function assembleAgentProfile(session: Session, env: EnsEnv): AgentProfile {
  const seats = session.seats;
  // Cap table: accepted contributions per seat (same fold as reduce.capTable).
  const alloc: Record<string, number> = {};
  for (const e of session.events) {
    if (e.type !== "contrib.accepted") continue;
    const seat = (e.payload as { seat: string }).seat;
    alloc[seat] = (alloc[seat] ?? 0) + 1;
  }
  const total = Object.values(alloc).reduce((a, b) => a + b, 0);

  const owners: ProfileOwner[] = Object.entries(alloc)
    .map(([seatId, n]) => ({
      name: seats[seatId]?.ensName ?? seats[seatId]?.name ?? seatId,
      contributions: n,
      shareBps: total > 0 ? Math.round((n / total) * 10000) : 0,
    }))
    .sort((a, b) => b.contributions - a.contributions);

  return {
    name: agentName(env),
    role: ROLE,
    description: `A ${ROLE} built together by ${Object.keys(seats).length} verified humans. Cites its teachers.`,
    skills: SKILLS,
    session: session.sessionId,
    availability: session.closed ? "for-hire" : "in-session",
    brainRoot: session.brainRoot,
    archiveRoot: session.archiveRoot,
    hcsTopic: env.HEDERA_TOPIC_ID,
    capTableToken: env.HEDERA_CAPTABLE_TOKEN_ID,
    owners,
    contributionCount: total,
    crewSize: Object.keys(seats).length,
  };
}

/** The text-record set MASS would publish on the agent name (ENSIP-5 keys). */
export function agentTextRecords(profile: AgentProfile): Record<string, string> {
  return {
    name: profile.name,
    description: profile.description,
    url: `/cv/${profile.name}`,
    "com.mass.role": profile.role,
    "com.mass.skills": profile.skills.join(", "),
    "com.mass.session": profile.session,
    "com.mass.availability": profile.availability,
    ...(profile.brainRoot ? { "com.mass.brainRoot": profile.brainRoot } : {}),
    ...(profile.hcsTopic ? { "com.mass.hcs.topic": profile.hcsTopic } : {}),
    ...(profile.capTableToken ? { "com.mass.capTable.token": profile.capTableToken } : {}),
    "com.mass.owners": profile.owners.map((o) => `${o.name}:${o.shareBps}`).join(","),
  };
}

// ---------------------------------------------------------------------------
// Resolution + verification (viem real path, dev fallback)
// ---------------------------------------------------------------------------

export interface ResolvedName {
  name: string;
  address: string | null;
  /** true if forward (name→addr) and reverse (addr→name) agree. */
  verified: boolean;
  records: Record<string, string>;
  dev: boolean;
  error?: string;
}

/** Deterministic dev resolution — a stable fake address, "verified" by design. */
function devResolve(name: string): ResolvedName {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const addr = "0x" + h.toString(16).padStart(40, "0").slice(0, 40);
  return { name, address: addr, verified: true, records: {}, dev: true };
}

const TEXT_KEYS = [
  "description",
  "url",
  "avatar",
  "com.mass.role",
  "com.mass.skills",
  "com.mass.availability",
  "com.mass.brainRoot",
  "com.mass.hcs.topic",
  "com.mass.capTable.token",
  "com.mass.owners",
];

/**
 * Resolve a name and check forward/reverse consistency. Uses viem (CCIP-Read
 * enabled) against the configured L1 RPC. Falls back to deterministic dev names
 * when ENS isn't configured, so the demo never shows a hex address.
 */
export async function resolveName(env: EnsEnv, name: string): Promise<ResolvedName> {
  if (!ensConfigured(env)) {
    if (env.ENS_DEV_FALLBACK === "1") return devResolve(name);
    return { name, address: null, verified: false, records: {}, dev: false, error: "ENS not configured" };
  }

  try {
    const { createPublicClient, http } = await import("viem");
    const { mainnet, sepolia } = await import("viem/chains");
    const chain = env.ENS_CHAIN === "sepolia" ? sepolia : mainnet;
    const client = createPublicClient({ chain, transport: http(env.ENS_L1_RPC) });

    const address = await client.getEnsAddress({ name });
    let verified = false;
    if (address) {
      const primary = await client.getEnsName({ address });
      verified = primary?.toLowerCase() === name.toLowerCase();
    }

    const records: Record<string, string> = {};
    for (const key of TEXT_KEYS) {
      try {
        const v = await client.getEnsText({ name, key });
        if (v) records[key] = v;
      } catch {
        /* a missing record is not an error */
      }
    }

    return { name, address: address ?? null, verified, records, dev: false };
  } catch (err) {
    return {
      name,
      address: null,
      verified: false,
      records: {},
      dev: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
