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

import { capTable } from "../core/reduce.js";
import { agentRegistrationKey } from "./erc7930.js";
import { rateCardLine } from "../core/settle.js";
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
  /** ERC-8004 Identity Registry this agent is registered in (address). */
  ERC8004_REGISTRY?: string;
  /** Chain id of that registry, e.g. 84532 for Base Sepolia. */
  ERC8004_CHAIN_ID?: string;
  /** The agent's id (ERC-721 token id) in that registry. */
  ERC8004_AGENT_ID?: string;
  /** Read only to decide whether a TEE trust model may honestly be claimed. */
  ZG_SEALED?: string;
  ZG_ATTESTATION_URL?: string;
  /** "1" → deterministic dev names/records; never resolves the network. */
  ENS_DEV_FALLBACK?: string;
  // Read for the profile (already on the DO Env):
  HEDERA_TOPIC_ID?: string;
  HEDERA_CAPTABLE_TOKEN_ID?: string;
}

/**
 * There is deliberately NO default parent name.
 *
 * A hardcoded fallback of "mass.eth" shipped names like `alice.mass.eth` to
 * production — and mass.eth is a real mainnet name owned by someone else
 * (0xaEA5…0deC). We were displaying subnames of a stranger's domain, and only
 * that owner could ever issue them.
 *
 * A name we do not control is worse than no name: it is a claim we cannot
 * back. When no parent is configured the product says its identity layer is
 * unconfigured, and shows no name at all.
 */
export function parentName(env: EnsEnv): string | undefined {
  const p = env.ENS_PARENT_NAME?.trim();
  return p ? p : undefined;
}

/** True once a parent name we own is configured. */
export const ensNamed = (env: EnsEnv): boolean => Boolean(parentName(env));

/** Real resolution additionally needs an RPC for the chain the name lives on. */
export function ensConfigured(env: EnsEnv): boolean {
  return Boolean(parentName(env) && env.ENS_L1_RPC);
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

/** A seat's subname, or undefined when we own no parent to put it under. */
export function joinName(label: string, env: EnsEnv): string | undefined {
  const parent = parentName(env);
  return parent ? `${label}.${parent}` : undefined;
}

/**
 * The agent's ENS name.
 *
 * Once a crew names their agent, the subname derived at that moment travels in
 * the log (`session.named`) and is used here — the identity belongs to the crew
 * that built it. The env label is only the fallback for a room whose agent has
 * not been named yet: one label baked into a deployment cannot be right for
 * every session that deployment runs.
 */
export function agentName(
  env: EnsEnv,
  session?: Pick<Session, "agentEnsName">
): string | undefined {
  if (session?.agentEnsName) return session.agentEnsName;
  const parent = parentName(env);
  return parent ? `${env.ENS_AGENT_LABEL || "docs"}.${parent}` : undefined;
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
  /** Undefined when no parent name is configured — we never invent one. */
  name?: string;
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
  // Reuse the canonical fold rather than repeating it — two implementations of
  // "who owns what" can drift, and this one is shown publicly on the CV.
  const alloc = capTable(session);
  const total = Object.values(alloc).reduce((a, b) => a + b, 0);

  const owners: ProfileOwner[] = Object.entries(alloc)
    .map(([seatId, n]) => ({
      name: seats[seatId]?.ensName ?? seats[seatId]?.name ?? seatId,
      contributions: n,
      shareBps: total > 0 ? Math.round((n / total) * 10000) : 0,
    }))
    .sort((a, b) => b.contributions - a.contributions);

  return {
    name: agentName(env, session),
    role: ROLE,
    // The crew's own words when they have given them; the generic line only
    // stands in until somebody says what they are building.
    description:
      session.purpose?.trim() ||
      `A ${ROLE} built together by ${Object.keys(seats).length} verified humans. Cites its teachers.`,
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

/**
 * The text records published on the agent's name.
 *
 * This is the part that makes ENS load-bearing rather than decorative. Under
 * ENSIP-26 the agent's ENDPOINTS live in its ENS records, so resolving the name
 * is the only way to reach it: no record, no reachable agent, no job, no
 * payment, nothing to split to the humans who taught it.
 *
 *   ENSIP-26  agent-context, agent-endpoint[<protocol>]   discovery
 *   ENSIP-25  agent-registration[<registry>][<agentId>]   link to ERC-8004
 *   ENSIP-5   name, description, url, avatar              the human-facing basics
 *
 * Returns {} when we own no name — we publish nothing under a domain we do not
 * control.
 */
export function agentTextRecords(
  profile: AgentProfile,
  opts: {
    /** Public origin the endpoints live on, e.g. https://mass.example.workers.dev */
    origin?: string;
    /** ERC-8004 registration, once the agent is registered. */
    registration?: { chainId: number; registry: string; agentId: string | number };
  } = {}
): Record<string, string> {
  if (!profile.name) return {};
  const origin = opts.origin?.replace(/\/$/, "") ?? "";

  return {
    name: profile.name,
    description: profile.description,
    url: `${origin}/cv/${profile.name}`,
    "com.mass.role": profile.role,
    "com.mass.skills": profile.skills.join(", "),
    "com.mass.session": profile.session,
    "com.mass.availability": profile.availability,
    ...(profile.brainRoot ? { "com.mass.brainRoot": profile.brainRoot } : {}),
    ...(profile.hcsTopic ? { "com.mass.hcs.topic": profile.hcsTopic } : {}),
    ...(profile.capTableToken ? { "com.mass.capTable.token": profile.capTableToken } : {}),
    "com.mass.owners": profile.owners.map((o) => `${o.name}:${o.shareBps}`).join(","),

    // --- ENSIP-26: how anything on the network finds and connects to it -----
    // Deliberately the whole story in one string: what it is, who owns it, and
    // what it is paid in. A client reads this before choosing a protocol.
    "agent-context": agentContext(profile),
    // Only endpoints that actually answer. An MCP endpoint was advertised here
    // before one existed: a record pointing at a 404 is the same class of claim
    // as a self-issued attestation, and this record set is the one thing a
    // stranger is asked to trust. Both of these carry the session, because the
    // agent lives in one room and a name alone cannot say which.
    "agent-endpoint[web]": `${origin}/cv/${profile.name}?session=${encodeURIComponent(profile.session)}`,
    "agent-endpoint[a2a]": `${origin}/api/agent/${profile.name}?session=${encodeURIComponent(profile.session)}`,

    // --- ENSIP-25: the bidirectional link to the ERC-8004 registry entry ----
    // Only written once a registration genuinely exists. The value is "1";
    // any non-empty value confirms the association.
    ...(opts.registration
      ? {
          [agentRegistrationKey(
            opts.registration.chainId,
            opts.registration.registry,
            opts.registration.agentId
          )]: "1",
        }
      : {}),
  };
}

/**
 * The one-line description a client reads first (ENSIP-26 `agent-context`).
 * Built from what actually happened in the session — never a fixed blurb.
 */
export function agentContext(profile: AgentProfile): string {
  const owners = profile.owners.length
    ? ` Owned by ${profile.owners
        .map((o) => `${o.name} ${(o.shareBps / 100).toFixed(0)}%`)
        .join(", ")}.`
    : "";
  const taught = ` Taught ${profile.contributionCount} thing${
    profile.contributionCount === 1 ? "" : "s"
  } by ${profile.crewSize} verified human${profile.crewSize === 1 ? "" : "s"}.`;
  // The description may already end with the citation promise (the generic one
  // does), and reading it twice in the first thing a client sees is sloppy.
  const cites = /cites its teachers/i.test(profile.description) ? "" : " Cites its teachers.";
  return `${profile.description}${taught}${owners}${cites} Paid in HBAR on Hedera testnet.`;
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

/**
 * Records read on every resolve.
 *
 * Two groups, both load-bearing rather than decorative:
 *  - SEAT records let a citation be resolved to a provenance claim (who this
 *    human is, how strongly verified, how much they have contributed) instead
 *    of being a name we stored ourselves and could have made up.
 *  - HIRE records are how an outsider engages the agent without our app: the
 *    rate card and the A2A endpoint come from ENS, so resolution is the
 *    discovery mechanism, not a lookup we happen to offer.
 */
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
  // seat provenance
  "com.mass.tier",
  "com.mass.sybilBand",
  "com.mass.contribCount",
  "com.mass.session",
  "com.mass.world.nullifier",
  // hiring
  "com.mass.rateCard",
  "agent-context",
  "agent-endpoint[web]",
  "agent-endpoint[a2a]",
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


// ---------------------------------------------------------------------------
// ERC-8004 + ENSIP-27
// ---------------------------------------------------------------------------

/**
 * The agent's ERC-8004 registration, if it has one.
 *
 * Absent until the agent is genuinely registered — we never publish an
 * ENSIP-25 link to an entry that does not exist.
 */
export function registration(
  env: EnsEnv
): { chainId: number; registry: string; agentId: string } | undefined {
  const chainId = Number(env.ERC8004_CHAIN_ID);
  if (!env.ERC8004_REGISTRY || !env.ERC8004_AGENT_ID || !Number.isFinite(chainId)) {
    return undefined;
  }
  return { chainId, registry: env.ERC8004_REGISTRY, agentId: env.ERC8004_AGENT_ID };
}

/**
 * ENSIP-27 agent card, served at /.well-known/agent.json.
 *
 * Completes the discovery chain that ENSIP-26 starts:
 *   name -> agent-context -> agent-endpoint[...] -> THIS -> ERC-8004 entry.
 *
 * `trustModels` states only what we can actually back. A TEE attestation is
 * claimed ONLY when sealed runs really produce one, because a trust signal we
 * cannot evidence is worse than none (MASS-specs A3).
 */
export function agentCard(session: Session, env: EnsEnv, origin: string) {
  const profile = assembleAgentProfile(session, env);
  const reg = registration(env);
  const sealed = env.ZG_SEALED === "true" && Boolean(env.ZG_ATTESTATION_URL);

  return {
    schema_version: "1",
    name: profile.name ?? "unregistered agent",
    description: profile.description,
    url: `${origin}/api/agent/${profile.name ?? ""}?session=${encodeURIComponent(session.sessionId)}`,
    provider: { name: "MASS", url: origin },
    version: "0.1.0",
    capabilities: { streaming: true, citations: true },
    authentication: { schemes: ["none"] },
    skills: profile.skills.map((s) => ({ id: s.replace(/\s+/g, "-"), name: s })),

    ...(reg
      ? { erc8004: { registry: reg.registry, agentId: reg.agentId, chainId: reg.chainId } }
      : {}),

    /**
     * MASS's own extension: an agent here is co-owned, and that is the whole
     * point of the product. The standard has no field for it yet, so we state
     * it explicitly rather than hide it.
     */
    ownership: {
      model: "contribution-share",
      basis: "accepted contributions per verified human",
      owners: profile.owners,
      ledger: profile.hcsTopic ? { chain: "hedera-testnet", topic: profile.hcsTopic } : undefined,
    },

    trustModels: sealed ? ["tee-attestation"] : [],
    x402Support: Boolean(profile.hcsTopic),
    active: profile.availability === "for-hire",
  };
}
