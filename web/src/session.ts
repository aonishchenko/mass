/**
 * WS client. Mirrors the server's rule: we render ONLY from MassEvents, plus an
 * ephemeral buffer for token deltas (shared-session-spec §3, §4.3).
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type Tier = "T1" | "T2" | "T3";
export type Lane = "draft" | "canonical";

export interface MassEvent {
  id: string;
  seq: number;
  ts: number;
  type: string;
  actor: { seat?: string; tier?: Tier; system?: true; agent?: true };
  /** Shown in the log so a row can be matched against its HCS anchor by eye. */
  payloadHash?: string;
  payload?: any;
}

export interface Candidate {
  candidateId: string;
  text: string;
  sourceEventId: string;
  seat: string;
  /** Extraction's suggestion. Unsuggested lines stay keepable — §7.5.2. */
  suggested: boolean;
  original?: string;
}

export interface Turn {
  id: string;
  role: "user" | "assistant";
  text: string;
  lane?: Lane;
  seatName?: string;
  attestationRef?: string;
  running?: boolean;
  /** Seat whose instruction produced this turn — drives per-seat run state. */
  seat?: string;
}

export interface Contribution {
  contribId: string;
  text: string;
  source: string;
  /** Build-path step this answers, when the crew follows the workflow. */
  slot?: string;
  proposedBy: string;
  cosigners: string[];
  state: "proposed" | "challenged" | "accepted" | "rejected";
  contribNumber?: number;
}

export interface SessionView {
  connected: boolean;
  /** What the crew said they are building (A4). Falls back in the UI. */
  purpose?: string;
  you: string | null;
  seats: Record<
    string,
    { seat: string; name: string; tier: Tier; sybilScore?: number; present: boolean; ensName?: string }
  >;
  /** True once any verification was issued by the DEV fallback (honesty banner). */
  devMode: boolean;
  events: MassEvent[];
  turns: Turn[];
  contributions: Record<string, Contribution>;
  capTable: Record<string, number>;
  brainRoot?: string;
  brainPending: boolean;
  archiveRoot?: string;
  candidates: Candidate[];
  /** instructId -> seat, so a started run can be attributed to its asker. */
  pendingInstruct?: Record<string, string | undefined>;
  harvestId?: string;
  harvestOpen: boolean;
  closed: boolean;
  /** Someone is generating — used for indicators, never to disable input. */
  running: boolean;
  /**
   * A run *you* started is in flight. Only this may gate your composer: in a
   * co-steering session another person's run must never lock your keyboard.
   */
  runningForYou: boolean;
  error?: string;
}

const EMPTY: SessionView = {
  connected: false,
  you: null,
  seats: {},
  events: [],
  turns: [],
  contributions: {},
  capTable: {},
  brainPending: false,
  candidates: [],
  harvestOpen: false,
  closed: false,
  running: false,
  runningForYou: false,
  devMode: false,
};

/** The same fold the server does — replay yields identical state (§4). */
function apply(v: SessionView, e: MassEvent): SessionView {
  const p = e.payload ?? {};
  switch (e.type) {
    case "session.named":
      return { ...v, purpose: p.purpose };
    case "seat.claimed":
      return {
        ...v,
        seats: {
          ...v.seats,
          [p.seat]: { seat: p.seat, name: p.name, tier: p.tier, present: true, ensName: p.ensName },
        },
      };
    case "seat.left": {
      const s = v.seats[p.seat];
      if (!s) return v;
      // Presence drives live authority: a signer leaving must reduce quorum on
      // screen, not just server-side (MASS-specs A4, DoD 5).
      return { ...v, seats: { ...v.seats, [p.seat]: { ...s, present: false } } };
    }
    case "seat.rejoined": {
      const s = v.seats[p.seat];
      if (!s) return v;
      return { ...v, seats: { ...v.seats, [p.seat]: { ...s, present: true } } };
    }
    case "verify.selfie.ok": {
      const s = v.seats[p.seat];
      if (!s) return v;
      // grantedTier, not a hardcoded T2: a low sybil score keeps this an Observer.
      return {
        ...v,
        devMode: v.devMode || !!p.dev,
        seats: { ...v.seats, [p.seat]: { ...s, tier: p.grantedTier, sybilScore: p.sybilScore } },
      };
    }
    case "verify.agentkit.ok": {
      const s = v.seats[p.seat];
      if (!s) return v;
      return {
        ...v,
        devMode: v.devMode || !!p.dev,
        seats: { ...v.seats, [p.seat]: { ...s, tier: "T3" } },
      };
    }
    case "instruct":
      return {
        ...v,
        pendingInstruct: { ...(v.pendingInstruct ?? {}), [p.instructId]: e.actor.seat },
        turns: [
          ...v.turns,
          {
            id: p.instructId,
            role: "user",
            text: p.text,
            lane: p.lane,
            seat: e.actor.seat,
            seatName: v.seats[e.actor.seat ?? ""]?.name,
          },
        ],
      };
    case "draft.started":
    case "canonical.started": {
      const seat = v.pendingInstruct?.[p.instructId];
      return {
        ...v,
        running: true,
        runningForYou: v.runningForYou || (!!seat && seat === v.you),
        turns: [
          ...v.turns,
          { id: p.runId, role: "assistant", text: "", lane: p.lane, running: true, seat },
        ],
      };
    }
    case "draft.completed":
    case "canonical.completed": {
      const turns = v.turns.map((t) =>
        t.id === p.runId
          ? { ...t, text: p.text, running: false, attestationRef: p.attestationRef }
          : t
      );
      return {
        ...v,
        turns,
        running: turns.some((t) => t.running),
        runningForYou: turns.some((t) => t.running && t.seat === v.you),
      };
    }
    case "contrib.proposed":
      return {
        ...v,
        contributions: {
          ...v.contributions,
          [p.contribId]: {
            contribId: p.contribId,
            text: p.text,
            source: p.source,
            slot: p.slot,
            proposedBy: e.actor.seat ?? "system",
            cosigners: [],
            state: "proposed",
          },
        },
      };
    case "contrib.screened": {
      const c = v.contributions[p.contribId];
      if (!c) return v;
      return {
        ...v,
        contributions: {
          ...v.contributions,
          [p.contribId]: { ...c, state: p.verdict === "flagged" ? "rejected" : c.state },
        },
      };
    }
    case "contrib.cosigned": {
      const c = v.contributions[p.contribId];
      if (!c || c.cosigners.includes(p.seat)) return v;
      return {
        ...v,
        contributions: {
          ...v.contributions,
          [p.contribId]: { ...c, cosigners: [...c.cosigners, p.seat] },
        },
      };
    }
    case "contrib.accepted": {
      const c = v.contributions[p.contribId];
      return {
        ...v,
        brainPending: true,
        capTable: { ...v.capTable, [p.seat]: (v.capTable[p.seat] ?? 0) + 1 },
        contributions: c
          ? {
              ...v.contributions,
              [p.contribId]: { ...c, state: "accepted", contribNumber: p.contribNumber },
            }
          : v.contributions,
      };
    }
    case "brain.updated":
      return { ...v, brainRoot: p.storageRootHash, brainPending: false };
    case "archive.written":
      return { ...v, archiveRoot: p.storageRootHash };
    case "harvest.opened":
      return { ...v, harvestOpen: true, harvestId: p.harvestId };
    case "harvest.closed":
    case "harvest.cancelled":
      return { ...v, harvestOpen: false, candidates: [] };
    case "session.closed":
      return { ...v, closed: true };
    default:
      return v;
  }
}

export type Intent = Record<string, unknown> & { kind: string };

/**
 * What the agent is doing right now, derived from the events we already have.
 *
 * A colleague has states. It also makes waiting legible: the careful lane is
 * slower, and "thinking…" explains a pause that a spinner does not.
 */
export function agentStatus(view: SessionView): "idle" | "thinking" | "learning" | "answering" {
  if (view.brainPending) return "learning";
  const running = view.turns.some((t) => t.running);
  if (running) return view.turns.some((t) => t.running && t.text.length > 0) ? "answering" : "thinking";
  return "idle";
}

/** Seat token is per-room, so two rooms in one browser keep separate seats. */
const seatKey = (sessionId: string) => `mass:seat:${sessionId}`;

export function useSession(sessionId: string) {
  const [view, setView] = useState<SessionView>(EMPTY);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    let closed = false;
    let attempt = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      if (closed) return;
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const socket = new WebSocket(`${proto}://${location.host}/ws?session=${sessionId}`);
      ws.current = socket;

      socket.onopen = () => {
        attempt = 0;
        setView((v) => ({ ...v, connected: true }));
        // Reclaim the seat we already hold in this room, if any. Without this a
        // refresh silently drops you to observer, which disables co-signing and
        // closing the session.
        const token = localStorage.getItem(seatKey(sessionId));
        if (token) socket.send(JSON.stringify({ kind: "resumeSeat", token }));
      };

      /**
       * Reconnect, always. A deploy, a laptop sleep or a dropped wifi packet
       * closes the socket, and without this the page sat there looking normal
       * while every button silently did nothing. Replay on reconnect means we
       * lose no state by rebuilding the connection.
       */
      socket.onclose = () => {
        setView((v) => ({ ...v, connected: false }));
        if (closed) return;
        const delay = Math.min(500 * 2 ** attempt++, 10_000);
        retry = setTimeout(connect, delay);
      };

      socket.onerror = () => socket.close();

      socket.onmessage = (m) => {
        const f = JSON.parse(m.data);

        if (f.t === "seated") {
          localStorage.setItem(seatKey(sessionId), f.token);
        }

        setView((v) => {
          if (f.t === "seated") return { ...v, you: f.seat };
          if (f.t === "sync") {
            // Replay the whole log; both tabs converge by construction.
            const you = f.you ?? v.you;
            if (!f.you && !v.you) localStorage.removeItem(seatKey(sessionId));
            const folded = f.events.reduce(apply, { ...EMPTY, connected: true, you });
            return { ...folded, events: f.events };
          }
          if (f.t === "event") {
            return { ...apply(v, f.e), events: [...v.events, f.e] };
          }
          if (f.t === "delta") {
            // Wire-only: append to the running turn, never to events.
            return {
              ...v,
              turns: v.turns.map((t) => (t.id === f.runId ? { ...t, text: t.text + f.token } : t)),
            };
          }
          if (f.t === "candidates") {
            return { ...v, candidates: f.candidates, harvestId: f.harvestId };
          }
          if (f.t === "error") return { ...v, error: f.message };
          return v;
        });
      };
    };

    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      ws.current?.close();
    };
  }, [sessionId]);

  const send = useCallback((intent: Intent) => {
    const socket = ws.current;
    // Silently dropping an intent on a closed socket is how "Join does nothing"
    // happens. Say so instead.
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setView((v) => ({ ...v, error: "reconnecting — try again in a moment" }));
      return;
    }
    socket.send(JSON.stringify(intent));
  }, []);

  const clearError = useCallback(() => setView((v) => ({ ...v, error: undefined })), []);

  return { view, send, clearError };
}

/**
 * Live authority (MASS-specs A4), recomputed client-side for affordances only.
 * Counts PRESENT seats, mirroring the server's computePerms — so when a signer
 * leaves, the co-sign affordance disables immediately (DoD 5).
 */
export function perms(view: SessionView) {
  const present = Object.values(view.seats).filter((s) => s.present);
  const presentT2 = present.filter((s) => s.tier === "T2" || s.tier === "T3").length;
  const presentT3 = present.filter((s) => s.tier === "T3").length;
  return { canDraft: presentT2 >= 1, canCommit: presentT3 >= 2, presentT2, presentT3 };
}
