/**
 * SessionRoom — the authoritative single writer for one session.
 *
 * shared-session-spec §2.1: the chain is not the transport. Real-time
 * coordination is this DO plus WebSockets; 0G provides durability, inference and
 * proof.
 *
 * §3: clients send Intents, the server emits Events, clients render only from
 * events. Token deltas are a separate frame type and NEVER enter the log (§4.3).
 */

import { DurableObject } from "cloudflare:workers";
import { newId, payloadHash } from "./core/ids.js";
import { atLeast, authorize, computePerms } from "./core/perms.js";
import { append, capTable } from "./core/reduce.js";
import {
  EMPTY_SESSION,
  type Candidate,
  type ContribAcceptedPayload,
  type ContribSource,
  type Frame,
  type Intent,
  type InstructPayload,
  type Lane,
  type MassEvent,
  type Seat,
  type Session,
} from "./core/types.js";
import { extractCandidates, runInference } from "./zg/inference.js";
import { writeArchive, writeBrain } from "./zg/storage.js";
import { mockScreen } from "./world/mock.js";
import { buildContext } from "./world/context.js";
import {
  issueToken,
  sybilThreshold,
  verifyToken,
  verifyWorldProof,
  type VerifyKind,
} from "./world/verify.js";
import {
  agentTextRecords,
  assembleAgentProfile,
  joinName,
  resolveName,
  uniqueSeatLabel,
} from "./ens/ens.js";
import {
  anchorEvent,
  hederaEnabled,
  payForInference,
  shouldAnchor,
} from "./hedera/client.js";
import { payloadHash as hashOf } from "./core/ids.js";

export interface Env {
  SESSION: DurableObjectNamespace<SessionRoom>;
  ASSETS: Fetcher;
  ZG_ROUTER_URL: string;
  ZG_ROUTER_KEY?: string;
  ZG_ROUTER_KEY_SEALED?: string;
  ZG_DRAFT_MODEL: string;
  ZG_CANONICAL_MODEL: string;
  ZG_SEALED?: string;
  ZG_STORAGE_RPC: string;
  ZG_STORAGE_INDEXER: string;
  ZG_PRIVATE_KEY?: string;
  SESSION_KEY?: string;
  ZG_STORAGE_SERVICE_URL?: string;
  STORAGE_AUTH_TOKEN?: string;
  HEDERA_TOPIC_ID?: string;
  HEDERA_OPERATOR_ID?: string;
  HEDERA_COMPUTE_ACCOUNT_ID?: string;
  HEDERA_CAPTABLE_TOKEN_ID?: string;
  HEDERA_INFERENCE_PRICE_HBAR?: string;
  // World (M3) — server-side proof verification. See docs/WORLD-SETUP.md.
  WORLD_APP_ID?: string;
  WORLD_RP_ID?: string;
  WORLD_VERIFY_URL?: string;
  WORLD_ACTION_SELFIE?: string;
  WORLD_ACTION_AGENTKIT?: string;
  WORLD_ENV?: string;
  WORLD_SYBIL_THRESHOLD?: string;
  WORLD_RP_PRIVATE_KEY?: string;
  WORLD_DEV_FALLBACK?: string;
  // ENS (M5) — identity & careers layer. See docs/ENS-TASK.md.
  ENS_PARENT_NAME?: string;
  ENS_AGENT_LABEL?: string;
  ENS_L1_RPC?: string;
  ENS_CHAIN?: string;
  ENS_DURIN_REGISTRY?: string;
  ENS_DEV_FALLBACK?: string;
}

interface SocketMeta {
  seat: string | null;
}

/**
 * How many times an anchor is retried before it stops being retried. At the
 * 60s backoff ceiling this is roughly five minutes of trying, which outlasts a
 * sidecar restart but not a sidecar that is simply gone. The row is kept and
 * still counted afterwards — see alarm().
 */
const MAX_ANCHOR_ATTEMPTS = 10;

export class SessionRoom extends DurableObject<Env> {
  private session: Session;
  /** Candidates live in harvest state, not in the log (§7.5.2). */
  private candidates: Candidate[] = [];
  /** Single write queue — storage never blocks acceptance (§8.2). */
  private brainQueue: Promise<void> = Promise.resolve();
  /** Seat that asked to close, waiting on an auto-opened harvest to resolve. */
  private pendingClose: Seat | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.session = EMPTY_SESSION("pending");

    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(
        `CREATE TABLE IF NOT EXISTS events (
           seq INTEGER PRIMARY KEY,
           body TEXT NOT NULL
         )`
      );
      // Seat credentials. Deliberately a separate table: these are secrets, and
      // everything in `events` is destined for the HCS anchor and the 0G archive.
      this.ctx.storage.sql.exec(
        `CREATE TABLE IF NOT EXISTS seat_tokens (
           token TEXT PRIMARY KEY,
           seat TEXT NOT NULL
         )`
      );
      // Events selected for anchoring that Hedera has not confirmed yet. A row
      // here is a gap between what our UI shows and what the public ledger
      // knows — so it is durable, retried by the alarm, and counted in the UI
      // rather than being silently lost.
      this.ctx.storage.sql.exec(
        `CREATE TABLE IF NOT EXISTS pending_anchors (
           event_id TEXT PRIMARY KEY,
           body TEXT NOT NULL,
           attempts INTEGER NOT NULL DEFAULT 0
         )`
      );
      // Sanitized record of every server-side verification, so the check can be
      // shown live at the booth (World rubric: proofs verified server-side).
      this.ctx.storage.sql.exec(
        `CREATE TABLE IF NOT EXISTS verify_log (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           ts INTEGER NOT NULL,
           kind TEXT NOT NULL,
           ok INTEGER NOT NULL,
           dev INTEGER NOT NULL,
           detail TEXT NOT NULL
         )`
      );
      // Persist first, cache second: memory is rebuilt by folding the log.
      const rows = this.ctx.storage.sql
        .exec<{ body: string }>("SELECT body FROM events ORDER BY seq")
        .toArray();
      const events = rows.map((r) => JSON.parse(r.body) as MassEvent);
      this.session = events.reduce(append, EMPTY_SESSION("pending"));
    });
  }

  // -------------------------------------------------------------------------
  // Transport
  // -------------------------------------------------------------------------

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.endsWith("/state")) {
      return Response.json({
        seats: Object.values(this.session.seats),
        perms: computePerms(Object.values(this.session.seats)),
        capTable: capTable(this.session),
        brainChunks: this.session.brainChunks,
        brainRoot: this.session.brainRoot,
        eventCount: this.session.events.length,
        ...this.sessionCounters(),
      });
    }

    // World server-side verification (M3 hard gate). These are plain HTTPS
    // requests, not the WebSocket — a proof is checked here, on the server,
    // before any seat is granted.
    if (url.pathname.endsWith("/verify/context")) {
      const kind: VerifyKind = url.searchParams.get("kind") === "agentkit" ? "agentkit" : "selfie";
      return Response.json(
        buildContext(this.env, kind, {
          environment: url.searchParams.get("env") ?? undefined,
          preset: url.searchParams.get("preset") ?? undefined,
        })
      );
    }
    // The session id travels with the request so the issued token can be bound
    // to this room only (see issueToken).
    const verifySession = url.searchParams.get("session") ?? "default";
    if (url.pathname.endsWith("/verify/selfie")) {
      return this.handleVerify(request, "selfie", verifySession);
    }
    if (url.pathname.endsWith("/verify/agentkit")) {
      return this.handleVerify(request, "agentkit", verifySession);
    }
    if (url.pathname.endsWith("/verify/log")) return this.handleVerifyLog();

    // ENS (M5) — resolve any name, or the agent's live employment record (CV).
    if (url.pathname.endsWith("/ens/resolve")) {
      return Response.json(await resolveName(this.env, url.searchParams.get("name") ?? ""));
    }
    if (url.pathname.endsWith("/ens/cv") || url.pathname.endsWith("/ens/agent")) {
      const profile = assembleAgentProfile(this.session, this.env);
      const resolved = await resolveName(this.env, url.searchParams.get("name") || profile.name);
      return Response.json({ profile, records: agentTextRecords(profile), resolved });
    }

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("expected websocket", { status: 426 });
    }

    const sessionId = url.searchParams.get("session") ?? "default";
    if (!this.session.created) await this.bootstrap(sessionId);

    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    pair[1].serializeAttachment({ seat: null } satisfies SocketMeta);

    // Replay: a joining client folds the log and matches everyone else (§4.1).
    pair[1].send(
      JSON.stringify({ t: "sync", events: this.session.events, you: null } satisfies Frame)
    );
    await this.sendCandidates(pair[1]);

    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    let intent: Intent;
    try {
      intent = JSON.parse(message as string) as Intent;
    } catch {
      return this.sendError(ws, "malformed intent");
    }

    const meta = (ws.deserializeAttachment() ?? { seat: null }) as SocketMeta;
    const seat: Seat | null = meta.seat ? this.session.seats[meta.seat] ?? null : null;

    const verdict = authorize(
      intent.kind,
      seat,
      this.session,
      intent.kind === "instruct" ? { lane: intent.lane } : {}
    );
    if (!verdict.ok) return this.sendError(ws, verdict.reason, intent.kind);

    try {
      await this.handle(intent, seat, ws);
    } catch (err) {
      console.error("intent failed", intent.kind, err);
      this.sendError(ws, err instanceof Error ? err.message : "intent failed", intent.kind);
    }
  }

  async webSocketClose(ws: WebSocket) {
    const meta = (ws.deserializeAttachment() ?? { seat: null }) as SocketMeta;
    if (!meta.seat) return;

    // A refresh closes the old socket AFTER the new one has already resumed the
    // seat, and a second tab holds the same seat legitimately. Emitting
    // seat.left unconditionally marked a present human absent, which silently
    // dropped signer quorum and blocked co-signing.
    const stillHere = this.ctx.getWebSockets().some((other) => {
      if (other === ws) return false;
      const m = (other.deserializeAttachment() ?? { seat: null }) as SocketMeta;
      return m.seat === meta.seat;
    });
    if (stillHere) return;

    await this.emit("seat.left", { seat: meta.seat }, { system: true });
    await this.recomputePerms();
  }

  // -------------------------------------------------------------------------
  // Event emission — the only path that mutates state
  // -------------------------------------------------------------------------

  /**
   * Non-deterministic values (id, ts, seq) are resolved HERE and baked into the
   * event, so `apply()` stays a pure fold (§4.2).
   */
  private async emit<P>(
    type: MassEvent["type"],
    payload: P,
    actor: MassEvent["actor"]
  ): Promise<MassEvent<P>> {
    // Hash BEFORE claiming a sequence number. Two co-steering humans produce
    // overlapping runs, and a DO yields at every await — so reading
    // events.length and then awaiting would let two emits claim the same seq
    // and collide on the primary key.
    const hash = await payloadHash(payload);

    // Everything below is synchronous, so it is atomic with respect to other
    // in-flight handlers: seq assignment, persistence and the in-memory fold
    // cannot interleave.
    const seq = this.session.events.length + 1;
    const event: MassEvent<P> = {
      id: newId("e"),
      seq,
      ts: Date.now(),
      type,
      actor,
      payloadHash: hash,
      payload,
    };

    this.ctx.storage.sql.exec(
      "INSERT INTO events (seq, body) VALUES (?, ?)",
      seq,
      JSON.stringify(event)
    );
    this.session = append(this.session, event);
    this.broadcast({ t: "event", e: event });

    // Anchor AFTER broadcasting. HCS consensus takes seconds; the session must
    // never wait on it, and a failed anchor must not lose a local event
    // (hedera-spec §4.2).
    if (shouldAnchor(type) && hederaEnabled(this.env)) {
      // Record the intent to anchor BEFORE attempting it. This DO uses the
      // WebSocket Hibernation API, so it can be evicted while a background send
      // is still in flight — and a lost `contrib.accepted` anchor would silently
      // cost someone their share, with the local UI still showing it. The row
      // survives hibernation; the alarm drains it on the next wake.
      this.ctx.storage.sql.exec(
        "INSERT OR IGNORE INTO pending_anchors (event_id, body, attempts) VALUES (?, ?, 0)",
        event.id,
        JSON.stringify(event)
      );
      await this.ctx.storage.setAlarm(Date.now() + 250);
    }

    return event;
  }

  /**
   * Drains the anchor queue. Runs on an alarm rather than in the background of
   * a request, so a hibernating object resumes the work instead of losing it.
   */
  async alarm() {
    if (!hederaEnabled(this.env)) return;

    // Only rows still worth trying. Without the attempts bound, five permanently
    // failing records would occupy the whole window in rowid order and every
    // event emitted after them would never be sent — the queue would look busy
    // while quietly anchoring nothing.
    const rows = this.ctx.storage.sql
      .exec<{ event_id: string; body: string; attempts: number }>(
        "SELECT event_id, body, attempts FROM pending_anchors WHERE attempts < ? ORDER BY rowid LIMIT 5",
        MAX_ANCHOR_ATTEMPTS
      )
      .toArray();
    if (rows.length === 0) return;

    for (const row of rows) {
      const event = JSON.parse(row.body) as MassEvent;
      try {
        const r = await anchorEvent(this.env, event);
        this.ctx.storage.sql.exec("DELETE FROM pending_anchors WHERE event_id = ?", row.event_id);
        console.log(`[hedera] anchored ${event.type} ${event.id} seq=${r.sequenceNumber}`);
        await this.emit(
          "hcs.anchored",
          { eventId: event.id, topicSequenceNumber: r.sequenceNumber, hederaTxId: r.txId },
          { system: true }
        );
      } catch (err) {
        this.ctx.storage.sql.exec(
          "UPDATE pending_anchors SET attempts = attempts + 1 WHERE event_id = ?",
          row.event_id
        );
        const attempts = row.attempts + 1;
        console.error(
          `[hedera] anchor failed ${event.type} ${event.id} attempt=${attempts}:`,
          String(err).slice(0, 160)
        );
        if (attempts >= MAX_ANCHOR_ATTEMPTS) {
          // Given up on, NOT discarded. The row stays, so the count keeps
          // reporting it and the UI keeps saying the ledger is missing it —
          // being permanently wrong out loud beats being quietly wrong.
          console.error(
            `[hedera] giving up on ${event.type} ${event.id} after ${attempts} attempts — still counted as unanchored`
          );
        }
      }
    }

    // Anything still worth trying gets another pass, backing off as attempts
    // grow so a persistently failing sidecar does not spin. Rows past the limit
    // are excluded, so the alarm eventually stops instead of retrying forever.
    const retryable = this.ctx.storage.sql
      .exec<{ n: number; worst: number | null }>(
        "SELECT COUNT(*) AS n, MAX(attempts) AS worst FROM pending_anchors WHERE attempts < ?",
        MAX_ANCHOR_ATTEMPTS
      )
      .toArray()[0];

    if ((retryable?.n ?? 0) > 0) {
      const worst = retryable?.worst ?? 0;
      await this.ctx.storage.setAlarm(Date.now() + Math.min(60_000, 1000 * 2 ** Math.min(worst, 6)));
    }
  }

  /**
   * Events selected for anchoring that the network has not confirmed yet —
   * including the ones we have stopped retrying. They are still missing from
   * the public ledger, which is the thing being reported.
   */
  private unanchoredCount(): number {
    return (
      this.ctx.storage.sql
        .exec<{ n: number }>("SELECT COUNT(*) AS n FROM pending_anchors")
        .toArray()[0]?.n ?? 0
    );
  }

  private broadcast(frame: Frame) {
    const body = JSON.stringify(frame);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(body);
      } catch {
        // Client vanished mid-send; its reconnect will replay the log.
      }
    }
  }

  private sendError(ws: WebSocket, message: string, intent?: Intent["kind"]) {
    ws.send(JSON.stringify({ t: "error", message, intent } satisfies Frame));
  }

  private async bootstrap(sessionId: string) {
    this.session = { ...this.session, sessionId };
    await this.emit("session.created", { sessionId }, { system: true });
  }

  /**
   * Counters we can state as fact, derived from the log — never estimated.
   * Anything not actually wired (payouts, distinct humans paid) is deliberately
   * absent rather than reported as zero: we quote these at the booth.
   */
  private sessionCounters() {
    const CITATION = /\(per [^)]*'s contribution #\d+\)/g;
    let citationsServed = 0;
    let contributionsAccepted = 0;

    for (const e of this.session.events) {
      if (e.type === "contrib.accepted") contributionsAccepted++;
      if (e.type === "canonical.completed" || e.type === "draft.completed") {
        const text = (e.payload as { text?: string })?.text ?? "";
        citationsServed += text.match(CITATION)?.length ?? 0;
      }
    }
    return {
      contributionsAccepted,
      citationsServed,
      // Surfaced deliberately: an anchor that never landed means the public
      // ledger disagrees with what we are showing, and that has to be visible
      // rather than discovered.
      unanchoredEvents: this.unanchoredCount(),
    };
  }

  private async recomputePerms() {
    const p = computePerms(Object.values(this.session.seats));
    await this.emit(
      "perm.recomputed",
      { canDraft: p.canDraft, canCommit: p.canCommit, presentT2: p.presentT2, presentT3: p.presentT3 },
      { system: true }
    );
  }

  // -------------------------------------------------------------------------
  // Intent handling
  // -------------------------------------------------------------------------

  private async handle(intent: Intent, seat: Seat | null, ws: WebSocket) {
    switch (intent.kind) {
      case "claimSeat":
        return this.claimSeat(intent.name, intent.selfieToken, ws);
      case "delegate":
        return this.delegate(intent.agentkitToken, seat!, ws);
      case "resumeSeat":
        return this.resumeSeat(intent.token, ws);
      case "instruct":
        return this.instruct(intent.text, intent.lane, seat!);
      case "proposeContrib":
        return this.propose(intent.text, intent.source, seat!, intent.fromRunId);
      case "challengeContrib":
        return this.emit(
          "contrib.challenged",
          { contribId: intent.contribId, reason: intent.reason },
          { seat: seat!.seat, tier: seat!.tier }
        );
      case "cosign":
        return this.cosign(intent.contribId, seat!);
      case "openHarvest":
        return this.openHarvest(seat!);
      case "keepCandidate":
        return this.keepCandidate(intent.harvestId, intent.candidateId, intent.text, seat!);
      case "cosignBatch":
        return this.cosignBatch(intent.harvestId, seat!);
      case "cancelHarvest": {
        await this.emit(
          "harvest.cancelled",
          { harvestId: intent.harvestId },
          { seat: seat!.seat, tier: seat!.tier }
        );
        // Cancelling the review is not cancelling the close — the crew already
        // asked to close, and chose to bank nothing.
        return this.finishPendingClose();
      }
      case "closeSession":
        return this.closeSession(seat!);
    }
  }

  private async claimSeat(name: string, selfieToken: string, ws: WebSocket) {
    // HARD GATE: a seat is granted only against a token the SERVER minted after
    // it verified a Selfie proof with World (see handleVerify). A client may send
    // any name, but never a valid token it did not earn — rendering the IDKit
    // widget is not enough.
    const claims = await verifyToken(this.env, selfieToken);
    if (!claims || claims.kind !== "selfie") {
      return this.sendError(ws, "Seat claim requires a verified Selfie Check.", "claimSeat");
    }

    // A proof is valid for the room it was verified for, and no other.
    if (claims.session !== this.session.sessionId) {
      return this.sendError(ws, "That verification was for a different session.", "claimSeat");
    }

    // One socket, one seat: a second claim used to silently orphan the first,
    // leaving a ghost in the crew list that nobody could act as.
    const existing = (ws.deserializeAttachment() ?? { seat: null }) as SocketMeta;
    if (existing.seat && this.session.seats[existing.seat]) {
      return this.sendError(ws, "You already hold a seat in this session.", "claimSeat");
    }

    // One verified human, one seat. The nullifier is World's per-action unique
    // human id, so re-using it is the same person claiming twice — which would
    // let one human hold several cap-table shares and defeat the entire
    // sybil-resistance claim.
    const duplicate = Object.values(this.session.seats).find(
      (s) => s.nullifierHash && s.nullifierHash === claims.nullifierHash
    );
    if (duplicate) {
      return this.sendError(
        ws,
        "This human already holds a seat in this session.",
        "claimSeat"
      );
    }

    const seatId = newId("s");
    // Assign a unique ENS subname now (M5) so the seat has a resolvable identity
    // from the first event — zero hex anywhere in the UI.
    const takenLabels = new Set(
      Object.values(this.session.seats)
        .map((st) => st.ensName?.split(".")[0])
        .filter((l): l is string => Boolean(l))
    );
    const ensName = joinName(uniqueSeatLabel(name, takenLabels), this.env);
    await this.emit("seat.claimed", { seat: seatId, name, tier: "T1", ensName }, { system: true });

    // Sybil score gates capability (HARD REQUIREMENT 2): below threshold the seat
    // is an Observer — a verified human, but not trusted to propose, co-sign, or
    // earn equity. The reason is derivable in the UI from tier + score.
    const threshold = sybilThreshold(this.env);
    const grantedTier: "T1" | "T2" = claims.sybilScore >= threshold ? "T2" : "T1";
    await this.emit(
      "verify.selfie.ok",
      {
        seat: seatId,
        sybilScore: claims.sybilScore,
        nullifierHash: claims.nullifierHash,
        grantedTier,
        threshold,
        dev: claims.dev,
      },
      { system: true }
    );

    const token = newId("tok") + crypto.randomUUID().replace(/-/g, "");
    this.ctx.storage.sql.exec(
      "INSERT INTO seat_tokens (token, seat) VALUES (?, ?)",
      token,
      seatId
    );

    ws.serializeAttachment({ seat: seatId } satisfies SocketMeta);
    // Private to this socket — never broadcast.
    ws.send(JSON.stringify({ t: "seated", seat: seatId, token } satisfies Frame));
    ws.send(JSON.stringify({ t: "sync", events: this.session.events, you: seatId } satisfies Frame));
    await this.sendCandidates(ws);
    await this.recomputePerms();
  }

  /**
   * Become a Signer by delegating to the session agent (HARD REQUIREMENT 3).
   * The token proves an Orb / AgentKit proof was verified server-side; the seat
   * must already be a Builder. Emitting verify.agentkit.ok recomputes authority
   * live for the whole room.
   */
  private async delegate(agentkitToken: string, seat: Seat, ws: WebSocket) {
    const claims = await verifyToken(this.env, agentkitToken);
    if (!claims || claims.kind !== "agentkit") {
      return this.sendError(ws, "Signer delegation requires a verified Orb / AgentKit proof.", "delegate");
    }
    if (claims.session !== this.session.sessionId) {
      return this.sendError(ws, "That verification was for a different session.", "delegate");
    }
    if (!atLeast(seat.tier, "T2")) {
      return this.sendError(ws, "Become a Builder (Selfie Check) before delegating as a Signer.", "delegate");
    }
    if (seat.tier === "T3") return; // already a signer

    await this.emit(
      "verify.agentkit.ok",
      { seat: seat.seat, proofRef: claims.nullifierHash, principal: claims.nullifierHash, dev: claims.dev },
      { system: true }
    );
    await this.recomputePerms();
  }

  // -------------------------------------------------------------------------
  // World — server-side verification handlers (M3 hard gate)
  // -------------------------------------------------------------------------

  /**
   * Verify an IDKit proof against World's cloud API, HERE on the server, and
   * only then mint an HMAC-signed token the DO will trust. A forged proof gets a
   * 401. Every attempt is logged (sanitized) for the on-stage check.
   */
  private async handleVerify(
    request: Request,
    kind: VerifyKind,
    session: string
  ): Promise<Response> {
    let proof: unknown = null;
    // The UI can try a different environment per attempt, so a mismatch can be
    // diagnosed without a redeploy.
    let envOverride: string | undefined;
    try {
      const body = (await request.json()) as { proof?: unknown; env?: string };
      proof = body?.proof ?? null;
      envOverride = body?.env;
    } catch {
      /* proof stays null → verification fails cleanly */
    }

    const outcome = await verifyWorldProof(this.env, kind, proof as never, envOverride);

    this.ctx.storage.sql.exec(
      "INSERT INTO verify_log (ts, kind, ok, dev, detail) VALUES (?, ?, ?, ?, ?)",
      outcome.verifiedAt,
      kind,
      outcome.ok ? 1 : 0,
      outcome.dev ? 1 : 0,
      JSON.stringify(outcome.raw ?? { error: outcome.error })
    );

    if (!outcome.ok) {
      return Response.json({ ok: false, error: outcome.error ?? "verification failed" }, { status: 401 });
    }

    const token = await issueToken(this.env, kind, outcome, session);
    if (kind === "selfie") {
      return Response.json({
        ok: true,
        nullifierHash: outcome.nullifierHash,
        sybilScore: outcome.sybilScore,
        verifiedAt: outcome.verifiedAt,
        dev: outcome.dev,
        token,
      });
    }
    return Response.json({
      ok: true,
      proofRef: outcome.nullifierHash,
      principal: outcome.nullifierHash,
      verifiedAt: outcome.verifiedAt,
      dev: outcome.dev,
      token,
    });
  }

  /** The booth-showable verification log (newest first, sanitized). */
  private handleVerifyLog(): Response {
    const rows = this.ctx.storage.sql
      .exec<{ ts: number; kind: string; ok: number; dev: number; detail: string }>(
        "SELECT ts, kind, ok, dev, detail FROM verify_log ORDER BY id DESC LIMIT 100"
      )
      .toArray()
      .map((r) => ({
        ts: r.ts,
        kind: r.kind,
        ok: r.ok === 1,
        dev: r.dev === 1,
        detail: JSON.parse(r.detail) as unknown,
      }));
    return Response.json({ verifications: rows });
  }

  /**
   * Reload used to cost you your seat, which silently disabled co-signing and
   * closing — the seat lived only in the socket attachment. The token restores
   * it, so a refresh is no longer a way to lose your stake in the session.
   */
  private async resumeSeat(token: string, ws: WebSocket) {
    const row = this.ctx.storage.sql
      .exec<{ seat: string }>("SELECT seat FROM seat_tokens WHERE token = ?", token)
      .toArray()[0];

    if (!row || !this.session.seats[row.seat]) {
      // Stale token (e.g. a different session): let the client claim afresh.
      ws.send(JSON.stringify({ t: "sync", events: this.session.events, you: null } satisfies Frame));
      return;
    }

    ws.serializeAttachment({ seat: row.seat } satisfies SocketMeta);
    ws.send(JSON.stringify({ t: "seated", seat: row.seat, token } satisfies Frame));
    ws.send(JSON.stringify({ t: "sync", events: this.session.events, you: row.seat } satisfies Frame));
    await this.sendCandidates(ws);
    await this.emit("seat.rejoined", { seat: row.seat }, { system: true });
    await this.recomputePerms();
  }

  private async instruct(text: string, lane: Lane, seat: Seat) {
    const instructId = newId("i");
    await this.emit<InstructPayload>(
      "instruct",
      { instructId, text, lane },
      { seat: seat.seat, tier: seat.tier }
    );

    const runId = newId("r");
    await this.emit(
      lane === "canonical" ? "canonical.started" : "draft.started",
      { runId, lane, instructId },
      { agent: true }
    );

    // Draft is exploratory, so it carries conversation history. Canonical does
    // NOT: a sealed, attested, cap-table-bearing answer must be a function of
    // (brain, question) alone. Feeding it unattested draft output both lets the
    // model answer without consulting the brain — killing the citation — and
    // quietly lets unattested content influence an attested result.
    const messages =
      lane === "canonical"
        ? [{ role: "user" as const, content: text }]
        : [...this.recentTurns(), { role: "user" as const, content: text }];

    // Deltas fan out on the wire only. The full text goes in the completion
    // event, which is what makes the log replayable (§4.3).
    const result = await runInference(
      this.env,
      lane,
      messages,
      this.session.brainChunks,
      (token) => this.broadcast({ t: "delta", runId, token })
    );

    await this.emit(
      lane === "canonical" ? "canonical.completed" : "draft.completed",
      {
        runId,
        lane,
        text: result.text,
        // Present ONLY when the provider actually returned an attestation.
        attestationRef: result.attestationRef,
        // Always true, never a proof: which endpoint/model/response produced it.
        zgRunRef: result.zgRunRef,
      },
      { agent: true }
    );

    // HARD REQUIREMENT 1 — the agent pays for its own canonical run. Draft runs
    // are free, matching the lane split (shared-session-spec §6).
    if (lane === "canonical") {
      await this.payForCanonicalRun(messages.map((m) => m.content).join("\n"));
    }
  }

  /**
   * hedera-spec §5.1. The memo is the inference request hash (x402), which is
   * what lets anyone take a payloadHash off HCS and find the payment that
   * settled it. Never fabricate a tx id: a failed payment emits nothing.
   */
  private async payForCanonicalRun(requestBody: string) {
    const to = this.env.HEDERA_COMPUTE_ACCOUNT_ID;
    if (!hederaEnabled(this.env) || !to) return;

    const requestHash = (await hashOf(requestBody)).slice(0, 32);
    const amountHbar = Number(this.env.HEDERA_INFERENCE_PRICE_HBAR ?? "0.1");

    try {
      const r = await payForInference(this.env, { to, amountHbar, requestHash });
      await this.emit(
        "payment.executed",
        { kind: "inference", hederaTxId: r.txId, amount: amountHbar, requestHash },
        { system: true }
      );
    } catch (err) {
      console.error("[hedera] inference payment failed", String(err).slice(0, 160));
    }
  }

  /** Last few completed turns, so the agent has conversational context. */
  private recentTurns(): { role: "user" | "assistant"; content: string }[] {
    const turns: { role: "user" | "assistant"; content: string }[] = [];
    for (const e of this.session.events.slice(-40)) {
      if (e.type === "instruct") {
        turns.push({ role: "user", content: (e.payload as InstructPayload).text });
      } else if (e.type === "draft.completed" || e.type === "canonical.completed") {
        turns.push({ role: "assistant", content: (e.payload as { text: string }).text });
      }
    }
    return turns.slice(-8);
  }

  private async propose(
    text: string,
    source: ContribSource,
    seat: Seat,
    fromRunId?: string
  ) {
    const contribId = newId("c");
    await this.emit(
      "contrib.proposed",
      { contribId, text, source, fromRunId },
      { seat: seat.seat, tier: seat.tier }
    );

    // Immune system (B2.2) runs BEFORE acceptance; verdict logged either way.
    const verdict = await mockScreen(text);
    await this.emit(
      "contrib.screened",
      { contribId, verdict: verdict.verdict, attestationRef: verdict.attestationRef },
      { system: true }
    );
    return contribId;
  }

  private async cosign(contribId: string, seat: Seat) {
    const c = this.session.contributions[contribId];
    if (!c) throw new Error("unknown contribution");
    if (c.state === "rejected") throw new Error("contribution was flagged by screening");
    if (c.cosigners.includes(seat.seat)) return;

    const count = c.cosigners.length + 1;
    await this.emit(
      "contrib.cosigned",
      { contribId, seat: seat.seat, count },
      { seat: seat.seat, tier: seat.tier }
    );

    if (count >= 2) await this.accept(contribId);
  }

  /** Acceptance is never blocked on storage (§8.2) — the brain write is queued. */
  private async accept(contribId: string, coveredBy?: string[]) {
    const c = this.session.contributions[contribId];
    if (!c || c.state === "accepted") return;

    const creditSeat = c.proposedBy;
    const contribNumber = (this.session.contribCounts[creditSeat] ?? 0) + 1;

    await this.emit<ContribAcceptedPayload>(
      "contrib.accepted",
      {
        contribId,
        seat: creditSeat,
        // The verified human being credited. A seat id is a per-session random;
        // this is what makes the share attributable to a unique person on the
        // public log, and it cannot be changed by the person it names.
        humanRef: await this.humanRef(creditSeat),
        contribNumber,
        text: c.text,
      },
      { system: true }
    );

    if (!coveredBy) {
      // Continuity ping per acceptance (B2.5). Batch variant is emitted once
      // per signer by cosignBatch (§7.5.4).
      await this.emit("verify.continuity.ok", { seat: creditSeat }, { system: true });
    }

    this.queueBrainWrite(contribId);
  }

  /**
   * A stable, opaque handle for the human holding a seat: the first 16 hex
   * characters of sha256(World nullifier). Publishable — it correlates within
   * our topic and is useless as a cross-app identifier.
   *
   * Undefined for a seat with no recorded nullifier (a legacy seat, or one from
   * before verification was wired), because inventing one would defeat the point.
   */
  private async humanRef(seatId: string): Promise<string | undefined> {
    const nullifier = this.session.seats[seatId]?.nullifierHash;
    if (!nullifier) return undefined;
    return (await hashOf(nullifier)).slice(0, 16);
  }

  private queueBrainWrite(contribId?: string) {
    this.brainQueue = this.brainQueue.then(async () => {
      const chunks = this.session.brainChunks;
      const prevRoot = this.session.brainRoot;
      try {
        const rootHash = await writeBrain(this.env, chunks, prevRoot);
        // Only on a real root hash. Never fabricate one (§8.2).
        await this.emit(
          "brain.updated",
          {
            storageRootHash: rootHash,
            prevRoot,
            chunkCount: chunks.length,
            // Which contribution caused this version. Without it the public log
            // can prove a brain existed and that a person contributed, but not
            // that their contribution is IN that brain — which is exactly the
            // link the payout story depends on.
            contribId,
          },
          { system: true }
        );
      } catch (err) {
        // Chunks stay in memory, no event emitted, pending chip stays (§10).
        console.error("brain write failed, will retry on next acceptance", err);
      }
    });
  }

  // -------------------------------------------------------------------------
  // Harvest (§7.5)
  // -------------------------------------------------------------------------

  /**
   * Rebuildable from the log on purpose: candidates used to be broadcast once
   * and held only in memory, so a refresh — or a DO eviction — left an open
   * harvest showing "nothing to review" and blocked closing the session.
   */
  private async buildCandidates(sinceSeq: number): Promise<Candidate[]> {
    // §7.5.3: candidates come from human `instruct` text ONLY, never agent answers.
    const humanLines = this.session.events
      .filter((e) => e.type === "instruct" && e.seq > sinceSeq && "seat" in e.actor)
      .map((e) => ({
        eventId: e.id,
        seat: (e.actor as { seat: string }).seat,
        text: (e.payload as InstructPayload).text,
      }));

    // Extraction PRE-MARKS, it does not filter (§7.5.2). Every human line stays
    // on the list; suggestion only changes emphasis. A model that misjudges a
    // line must not be able to silently veto someone's contribution.
    // "found nothing" and "broke" must behave differently: an empty result is a
    // real answer (none of it was teaching), whereas a failure must not hide
    // material the crew actually said.
    let suggestions = new Map<string, string>();
    let extractionOk = false;
    if (this.env.ZG_ROUTER_KEY) {
      try {
        const extracted = await extractCandidates(this.env, humanLines);
        suggestions = new Map(extracted.map((e) => [e.eventId, e.text]));
        extractionOk = true;
      } catch (err) {
        console.error("extraction failed; falling back to every line", err);
      }
    }

    const all = humanLines.map((p) => {
      const rewritten = suggestions.get(p.eventId);
      return {
        // Derived from the source event, NOT random: candidates are rebuilt on
        // every reconnect, and a fresh random id would orphan the ids a client
        // is already holding ("unknown candidate" on Keep).
        candidateId: `cand_${p.eventId}`,
        text: rewritten ?? p.text,
        original: rewritten && rewritten !== p.text ? p.text : undefined,
        sourceEventId: p.eventId,
        seat: p.seat,
        suggested: rewritten !== undefined,
      };
    });

    // Show only what the model judged teachable. Listing every line back was
    // right when harvest was the ONLY way in, but "Teach this" now sits under
    // every message, so a missed line is one click away and the review stays
    // short. Without a working extractor there is no judgement to apply, so
    // everything stays selectable.
    return extractionOk ? all.filter((c) => c.suggested) : all;
  }

  private async openHarvest(seat: Seat): Promise<number> {
    const harvestId = newId("h");
    const sinceSeq = this.session.lastHarvestedSeq;
    this.candidates = await this.buildCandidates(sinceSeq);

    await this.emit(
      "harvest.opened",
      { harvestId, sinceSeq, candidateCount: this.candidates.length },
      { seat: seat.seat, tier: seat.tier }
    );
    this.broadcast({ t: "candidates", harvestId, candidates: this.candidates });
    return this.candidates.length;
  }

  /** Give a (re)connecting client the open harvest's candidates. */
  private async sendCandidates(ws: WebSocket) {
    const h = this.session.harvest;
    if (!h?.open) return;
    if (this.candidates.length === 0) {
      this.candidates = await this.buildCandidates(h.sinceSeq);
    }
    ws.send(
      JSON.stringify({
        t: "candidates",
        harvestId: h.harvestId,
        candidates: this.candidates,
      } satisfies Frame)
    );
  }

  private async keepCandidate(harvestId: string, candidateId: string, text: string, seat: Seat) {
    const cand = this.candidates.find((c) => c.candidateId === candidateId);
    if (!cand) throw new Error("unknown candidate");

    const contribId = newId("c");
    await this.emit(
      "contrib.proposed",
      { contribId, text, source: "harvest", harvestId, fromEventId: cand.sourceEventId },
      { seat: seat.seat, tier: seat.tier }
    );
    const verdict = await mockScreen(text);
    await this.emit(
      "contrib.screened",
      { contribId, verdict: verdict.verdict, attestationRef: verdict.attestationRef },
      { system: true }
    );
  }

  /**
   * One co-sign over the whole batch. Each item still emits its own
   * contrib.accepted, so the cap-table fold is unchanged (§7.5.2 step 4).
   */
  private async cosignBatch(harvestId: string, seat: Seat) {
    const pending = Object.values(this.session.contributions).filter(
      (c) => c.harvestId === harvestId && c.state === "proposed"
    );
    if (pending.length === 0) throw new Error("nothing kept in this harvest");

    for (const c of pending) {
      if (!c.cosigners.includes(seat.seat)) {
        await this.emit(
          "contrib.cosigned",
          { contribId: c.contribId, seat: seat.seat, count: c.cosigners.length + 1, harvestId },
          { seat: seat.seat, tier: seat.tier }
        );
      }
    }

    // One continuity ping per signing T3 per batch, logged with what it covers.
    await this.emit(
      "verify.continuity.ok",
      { seat: seat.seat, covers: pending.map((c) => c.contribId) },
      { system: true }
    );

    const ready = pending.filter(
      (c) => (this.session.contributions[c.contribId]?.cosigners.length ?? 0) >= 2
    );
    for (const c of ready) await this.accept(c.contribId, [seat.seat]);

    if (ready.length > 0) {
      const kept = ready.map((c) => c.contribId);
      await this.emit(
        "harvest.closed",
        {
          harvestId,
          kept,
          dropped: this.candidates.length - kept.length,
          lastSeq: this.session.events.length,
        },
        { seat: seat.seat, tier: seat.tier }
      );
      this.candidates = [];
      await this.finishPendingClose();
    }
  }

  /** Completes a close that was interrupted to run the review. */
  private async finishPendingClose() {
    const seat = this.pendingClose;
    if (!seat || this.session.harvest?.open || this.session.closed) return;
    this.pendingClose = null;
    await this.closeSession(seat);
  }

  // -------------------------------------------------------------------------
  // Close
  // -------------------------------------------------------------------------

  /** Human instructions since the last harvest — the raw harvest material. */
  private unharvestedCount(): number {
    return this.session.events.filter(
      (e) =>
        e.type === "instruct" &&
        e.seq > this.session.lastHarvestedSeq &&
        "seat" in e.actor
    ).length;
  }

  private async closeSession(seat: Seat) {
    // §7.5.1: harvest is auto-offered at close. Closing is ONE action from the
    // crew's point of view — it opens the review, and finishes itself once the
    // review resolves (see finishPendingClose). Making them press Close twice
    // was busywork.
    if (!this.session.harvest?.open && this.unharvestedCount() > 0) {
      const found = await this.openHarvest(seat);
      if (found > 0) {
        this.pendingClose = seat;
        throw new Error(
          "Before closing: keep anything worth teaching. The session closes itself once you co-sign or cancel."
        );
      }
      // Nothing to review — do not strand the crew behind an empty harvest.
      await this.emit(
        "harvest.cancelled",
        { harvestId: this.session.harvest!.harvestId },
        { system: true }
      );
    }

    this.pendingClose = null;
    await this.brainQueue; // let pending brain writes land before sealing
    try {
      const rootHash = await writeArchive(this.env, this.session.events);
      await this.emit(
        "archive.written",
        { storageRootHash: rootHash, eventCount: this.session.events.length },
        { system: true }
      );
    } catch (err) {
      console.error("archive write failed", err);
    }
    await this.emit(
      "session.closed",
      { capTable: capTable(this.session) },
      { seat: seat.seat, tier: seat.tier }
    );
  }
}
