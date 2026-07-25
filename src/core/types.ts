/**
 * Event schema, intents and wire frames.
 *
 * Source of truth: MASS-specs.md C1-C4 (frozen) + shared-session-spec.md §9
 * (additive extensions). Nothing here removes or renames a C1 member.
 *
 * The §9.1 rename decision (draft/canonical event prefixes -> a single `run`
 * prefix) is UNRESOLVED; we ship the spec's stated default of frozen names.
 */

export type Tier = "T1" | "T2" | "T3";
export type Lane = "draft" | "canonical";

/** shared-session-spec §7.3 */
export type ContribSource = "composer" | "draft" | "harvest";

export type EventType =
  | "session.created"
  | "seat.claimed"
  | "seat.left"
  | "seat.rejoined"
  | "verify.selfie.ok"
  | "verify.agentkit.ok"
  | "verify.continuity.ok"
  | "verify.identity.ok"
  | "perm.recomputed"
  | "instruct"
  | "handoff"
  | "draft.started"
  | "draft.completed"
  | "contrib.proposed"
  | "contrib.challenged"
  | "contrib.cosigned"
  | "contrib.screened"
  | "contrib.accepted"
  | "canonical.started"
  | "canonical.completed"
  | "payment.executed"
  | "brain.updated"
  | "session.closed"
  | "captable.minted"
  | "agent.minted"
  | "job.received"
  | "job.paidout"
  // shared-session-spec §9 additions
  | "archive.written"
  | "harvest.opened"
  | "harvest.closed"
  | "harvest.cancelled"
  // hedera-spec §9
  | "job.settled"
  | "payout"
  | "hcs.anchored";

export type Actor =
  | { seat: string; tier: Tier }
  | { system: true }
  | { agent: true };

export interface EventRefs {
  hederaTxId?: string;
  hcsSeq?: number;
  attestationRef?: string;
  storageRootHash?: string;
  ensName?: string;
}

export interface MassEvent<P = unknown> {
  id: string;
  /** Monotonic per session. Assigned by the single writer. */
  seq: number;
  ts: number;
  type: EventType;
  actor: Actor;
  /** sha256. HCS receives ONLY {id,ts,type,actorTier,payloadHash} — C1. */
  payloadHash: string;
  /** In-memory + encrypted 0G only. NEVER sent to HCS. */
  payload?: P;
  refs?: EventRefs;
}

// ---------------------------------------------------------------------------
// Payloads (shared-session-spec §9)
// ---------------------------------------------------------------------------

export interface SeatClaimedPayload {
  seat: string;
  name: string;
  tier: Tier;
  /** ENS subname assigned to this seat (M5). Deterministic; unique per session. */
  ensName?: string;
}

export interface SelfieOkPayload {
  seat: string;
  sybilScore: number;
  /** World nullifier for this Selfie proof (audit only; no PII). */
  nullifierHash: string;
  /** Tier this proof grants: T2 if sybilScore >= threshold, else T1 (Observer). */
  grantedTier: Tier;
  /** Threshold applied — lets the UI explain an Observer downgrade. */
  threshold: number;
  /** True when issued by the DEV fallback (NOT verified against World). */
  dev?: boolean;
}

export interface AgentKitOkPayload {
  seat: string;
  /** AgentKit / Orb delegation reference (the proof's nullifier). */
  proofRef: string;
  /** Anonymous human principal backing the delegation to the session agent. */
  principal: string;
  dev?: boolean;
}

export interface ContinuityOkPayload {
  seat: string;
  /** Batch acceptance covers many contributions at once — §7.5.4. */
  covers?: string[];
}

export interface PermRecomputedPayload {
  canDraft: boolean;
  canCommit: boolean;
  presentT2: number;
  presentT3: number;
}

export interface InstructPayload {
  instructId: string;
  text: string;
  lane: Lane;
}

export interface RunStartedPayload {
  runId: string;
  lane: Lane;
  instructId: string;
}

export interface RunCompletedPayload {
  runId: string;
  lane: Lane;
  /** Full text. Without this the log is unreplayable — §4.3. */
  text: string;
  attestationRef?: string;
}

export interface ContribProposedPayload {
  contribId: string;
  text: string;
  source: ContribSource;
  fromRunId?: string;
  harvestId?: string;
  fromEventId?: string;
}

export interface ContribChallengedPayload {
  contribId: string;
  reason: string;
}

export interface ContribCosignedPayload {
  contribId: string;
  seat: string;
  /** Signature count after this cosign. */
  count: number;
  harvestId?: string;
}

export interface ContribScreenedPayload {
  contribId: string;
  verdict: "pass" | "flagged";
  attestationRef?: string;
}

export interface ContribAcceptedPayload {
  contribId: string;
  /** Seat credited on the cap table. */
  seat: string;
  /** Per-contributor counter, drives "Alice #7" citations — C2. */
  contribNumber: number;
  text: string;
}

export interface BrainUpdatedPayload {
  storageRootHash: string;
  prevRoot?: string;
  chunkCount: number;
}

export interface ArchiveWrittenPayload {
  storageRootHash: string;
  eventCount: number;
}

export interface HarvestOpenedPayload {
  harvestId: string;
  /** Last harvested seq — candidates are drawn from after this point. */
  sinceSeq: number;
  candidateCount: number;
}

export interface HarvestClosedPayload {
  harvestId: string;
  kept: string[];
  dropped: number;
  lastSeq: number;
}

export interface HarvestCancelledPayload {
  harvestId: string;
}

// ---------------------------------------------------------------------------
// Brain (C2)
// ---------------------------------------------------------------------------

export interface BrainChunk {
  /** = contrib event id */
  chunkId: string;
  /** ENS seat name */
  contributor: string;
  contribNumber: number;
  content: string;
  screened: boolean;
  attestationRef?: string;
}

/** Wrapper written to 0G Storage. prevRoot hash-links versions — §8.2. */
export interface BrainDoc {
  v: 1;
  prevRoot?: string;
  chunks: BrainChunk[];
  ts: number;
}

// ---------------------------------------------------------------------------
// Intents — client -> server. A request, never a fact (§3).
// ---------------------------------------------------------------------------

export type Intent =
  /**
   * Claim a seat. `selfieToken` is a server-issued, HMAC-signed proof that a
   * Selfie Check was verified SERVER-SIDE (see src/world/verify.ts). The DO
   * rejects a claim without a valid token — a client can never self-assert
   * verification.
   */
  | { kind: "claimSeat"; name: string; selfieToken: string }
  /**
   * Delegate to the session agent as a Signer. `agentkitToken` is a
   * server-verified Orb / AgentKit proof. Requires an existing Builder seat.
   */
  | { kind: "delegate"; agentkitToken: string }
  /** Re-attach to an existing seat after a reload, using the seat's token. */
  | { kind: "resumeSeat"; token: string }
  | { kind: "instruct"; text: string; lane: Lane }
  | { kind: "proposeContrib"; text: string; source: ContribSource; fromRunId?: string }
  | { kind: "challengeContrib"; contribId: string; reason: string }
  | { kind: "cosign"; contribId: string }
  | { kind: "openHarvest" }
  | { kind: "keepCandidate"; harvestId: string; candidateId: string; text: string }
  | { kind: "cosignBatch"; harvestId: string }
  | { kind: "cancelHarvest"; harvestId: string }
  | { kind: "closeSession" };

export type IntentKind = Intent["kind"];

// ---------------------------------------------------------------------------
// Wire frames — server -> client (§3).
// ---------------------------------------------------------------------------

export type Frame =
  /** Durable, hashable, HCS-bound. */
  | { t: "event"; e: MassEvent }
  /** Ephemeral fan-out. NEVER enters the log — §4.3. */
  | { t: "delta"; runId: string; token: string }
  /** Full replay on connect/reconnect. */
  | { t: "sync"; events: MassEvent[]; you: string | null }
  /**
   * Sent only to the socket that claimed the seat. The token is a credential,
   * so it never enters the event log, the HCS anchor or the 0G archive.
   */
  | { t: "seated"; seat: string; token: string }
  /** Harvest candidates live in harvest state, not in the log — §7.5.2. */
  | { t: "candidates"; harvestId: string; candidates: Candidate[] }
  | { t: "error"; message: string; intent?: IntentKind };

export interface Candidate {
  candidateId: string;
  text: string;
  sourceEventId: string;
  seat: string;
  /**
   * Extraction's opinion, not its verdict. §7.5.2 says candidates are
   * PRE-MARKED, not filtered: the crew always sees everything they said, so a
   * model that misjudges a line cannot silently veto a contribution.
   */
  suggested: boolean;
  /** Extraction's cleaned-up rewrite, when it differs from what was said. */
  original?: string;
}

// ---------------------------------------------------------------------------
// Session state — derived only by folding events (§4).
// ---------------------------------------------------------------------------

export interface Seat {
  seat: string;
  name: string;
  tier: Tier;
  present: boolean;
  sybilScore?: number;
  /** ENS subname (M5) — the seat's resolvable identity; zero-hex everywhere. */
  ensName?: string;
  /** World nullifier of the Selfie proof (audit; opaque, no PII). */
  nullifierHash?: string;
  /** AgentKit / Orb delegation reference, set when the seat becomes a Signer. */
  proofRef?: string;
  /** When this seat's identity was last verified (ms). */
  verifiedAt?: number;
  /** Continuity re-verification timestamp (§B2.5). */
  lastContinuityAt?: number;
}

export type ContribState =
  | "proposed"
  | "challenged"
  | "accepted"
  | "rejected";

export interface Contribution {
  contribId: string;
  text: string;
  source: ContribSource;
  proposedBy: string;
  state: ContribState;
  cosigners: string[];
  screened: boolean;
  harvestId?: string;
  contribNumber?: number;
}

export interface Harvest {
  harvestId: string;
  sinceSeq: number;
  open: boolean;
  keptContribIds: string[];
}

export interface Session {
  sessionId: string;
  created: boolean;
  closed: boolean;
  seats: Record<string, Seat>;
  events: MassEvent[];
  contributions: Record<string, Contribution>;
  /** Accepted chunks only. Never contains draft output. */
  brainChunks: BrainChunk[];
  brainRoot?: string;
  archiveRoot?: string;
  harvest?: Harvest;
  /** Per-contributor accepted counter — drives contribNumber. */
  contribCounts: Record<string, number>;
  lastHarvestedSeq: number;
}

export const EMPTY_SESSION = (sessionId: string): Session => ({
  sessionId,
  created: false,
  closed: false,
  seats: {},
  events: [],
  contributions: {},
  brainChunks: [],
  contribCounts: {},
  lastHarvestedSeq: 0,
});
