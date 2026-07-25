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
  ZG_DRAFT_MODEL: string;
  ZG_CANONICAL_MODEL: string;
  ZG_SEALED?: string;
  ZG_STORAGE_RPC: string;
  ZG_STORAGE_INDEXER: string;
  ZG_PRIVATE_KEY?: string;
  SESSION_KEY?: string;
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
    const seq = this.session.events.length + 1;
    const event: MassEvent<P> = {
      id: newId("e"),
      seq,
      ts: Date.now(),
      type,
      actor,
      payloadHash: await payloadHash(payload),
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
      case "cancelHarvest":
        return this.emit("harvest.cancelled", { harvestId: intent.harvestId }, { seat: seat!.seat, tier: seat!.tier });
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

    ws.serializeAttachment({ seat: seatId } satisfies SocketMeta);
    ws.send(JSON.stringify({ t: "sync", events: this.session.events, you: seatId } satisfies Frame));
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

    // Deltas fan out on the wire only. The full text goes in the completion
    // event, which is what makes the log replayable (§4.3).
    const history = this.recentTurns();
    const result = await runInference(
      this.env,
      lane,
      [...history, { role: "user", content: text }],
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

  private async openHarvest(seat: Seat) {
    const harvestId = newId("h");
    const sinceSeq = this.session.lastHarvestedSeq;

    // §7.5.3: candidates come from human `instruct` text ONLY, never agent answers.
    const humanLines = this.session.events
      .filter((e) => e.type === "instruct" && e.seq > sinceSeq && "seat" in e.actor)
      .map((e) => ({
        eventId: e.id,
        seat: (e.actor as { seat: string }).seat,
        text: (e.payload as InstructPayload).text,
      }));

    // Manual harvest is the baseline; extraction is an enhancement on top and
    // must never be a dependency (§7.5.6).
    let picked = humanLines;
    if (this.env.ZG_ROUTER_KEY) {
      try {
        const extracted = await extractCandidates(this.env, humanLines);
        if (extracted.length > 0) picked = extracted;
      } catch (err) {
        console.error("extraction failed, falling back to manual harvest", err);
      }
    }

    this.candidates = picked.map((p) => ({
      candidateId: newId("cand"),
      text: p.text,
      sourceEventId: p.eventId,
      seat: p.seat,
    }));

    await this.emit(
      "harvest.opened",
      { harvestId, sinceSeq, candidateCount: this.candidates.length },
      { seat: seat.seat, tier: seat.tier }
    );
    this.broadcast({ t: "candidates", harvestId, candidates: this.candidates });
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
    }
  }

  // -------------------------------------------------------------------------
  // Close
  // -------------------------------------------------------------------------

  private async closeSession(seat: Seat) {
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
