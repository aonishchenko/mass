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
import { authorize, computePerms } from "./core/perms.js";
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
}

interface SocketMeta {
  seat: string | null;
}

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
      });
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
    return event;
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
        return this.claimSeat(intent.name, ws);
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

  private async claimSeat(name: string, ws: WebSocket) {
    const seatId = newId("s");
    await this.emit("seat.claimed", { seat: seatId, name, tier: "T1" }, { system: true });

    // Mocked until M3 wires server-side World verification (spec DoD hard gate).
    await this.emit(
      "verify.selfie.ok",
      { seat: seatId, sybilScore: 0.87, attestationHash: `mock_${seatId}` },
      { system: true }
    );
    await this.emit("verify.agentkit.ok", { seat: seatId }, { system: true });

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
      { runId, lane, text: result.text, attestationRef: result.attestationRef },
      { agent: true }
    );

    if (lane === "canonical" && result.sealed) {
      await this.emit("payment.executed", { kind: "inference", hederaTxId: "mock_tx" }, { system: true });
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
      { contribId, seat: creditSeat, contribNumber, text: c.text },
      { system: true }
    );

    if (!coveredBy) {
      // Continuity ping per acceptance (B2.5). Batch variant is emitted once
      // per signer by cosignBatch (§7.5.4).
      await this.emit("verify.continuity.ok", { seat: creditSeat }, { system: true });
    }

    this.queueBrainWrite();
  }

  private queueBrainWrite() {
    this.brainQueue = this.brainQueue.then(async () => {
      const chunks = this.session.brainChunks;
      const prevRoot = this.session.brainRoot;
      try {
        const rootHash = await writeBrain(this.env, chunks, prevRoot);
        // Only on a real root hash. Never fabricate one (§8.2).
        await this.emit(
          "brain.updated",
          { storageRootHash: rootHash, prevRoot, chunkCount: chunks.length },
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
    let suggestions = new Map<string, string>();
    if (this.env.ZG_ROUTER_KEY) {
      try {
        const extracted = await extractCandidates(this.env, humanLines);
        suggestions = new Map(extracted.map((e) => [e.eventId, e.text]));
      } catch (err) {
        console.error("extraction failed; every line stays selectable", err);
      }
    }

    return humanLines.map((p) => {
      const rewritten = suggestions.get(p.eventId);
      return {
        candidateId: newId("cand"),
        text: rewritten ?? p.text,
        original: rewritten && rewritten !== p.text ? p.text : undefined,
        sourceEventId: p.eventId,
        seat: p.seat,
        suggested: rewritten !== undefined,
      };
    });
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
