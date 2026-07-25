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
}

export interface Contribution {
  contribId: string;
  text: string;
  source: string;
  proposedBy: string;
  cosigners: string[];
  state: "proposed" | "challenged" | "accepted" | "rejected";
  contribNumber?: number;
}

export interface SessionView {
  connected: boolean;
  you: string | null;
  seats: Record<string, { seat: string; name: string; tier: Tier; sybilScore?: number }>;
  events: MassEvent[];
  turns: Turn[];
  contributions: Record<string, Contribution>;
  capTable: Record<string, number>;
  brainRoot?: string;
  brainPending: boolean;
  archiveRoot?: string;
  candidates: Candidate[];
  harvestId?: string;
  harvestOpen: boolean;
  closed: boolean;
  running: boolean;
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
};

/** The same fold the server does — replay yields identical state (§4). */
function apply(v: SessionView, e: MassEvent): SessionView {
  const p = e.payload ?? {};
  switch (e.type) {
    case "seat.claimed":
      return { ...v, seats: { ...v.seats, [p.seat]: { seat: p.seat, name: p.name, tier: p.tier } } };
    case "seat.left":
      return v;
    case "verify.selfie.ok": {
      const s = v.seats[p.seat];
      if (!s) return v;
      return { ...v, seats: { ...v.seats, [p.seat]: { ...s, tier: "T2", sybilScore: p.sybilScore } } };
    }
    case "verify.agentkit.ok": {
      const s = v.seats[p.seat];
      if (!s) return v;
      return { ...v, seats: { ...v.seats, [p.seat]: { ...s, tier: "T3" } } };
    }
    case "instruct":
      return {
        ...v,
        turns: [
          ...v.turns,
          {
            id: p.instructId,
            role: "user",
            text: p.text,
            lane: p.lane,
            seatName: v.seats[e.actor.seat ?? ""]?.name,
          },
        ],
      };
    case "draft.started":
    case "canonical.started":
      return {
        ...v,
        running: true,
        turns: [...v.turns, { id: p.runId, role: "assistant", text: "", lane: p.lane, running: true }],
      };
    case "draft.completed":
    case "canonical.completed":
      return {
        ...v,
        running: false,
        turns: v.turns.map((t) =>
          t.id === p.runId
            ? { ...t, text: p.text, running: false, attestationRef: p.attestationRef }
            : t
        ),
      };
    case "contrib.proposed":
      return {
        ...v,
        contributions: {
          ...v.contributions,
          [p.contribId]: {
            contribId: p.contribId,
            text: p.text,
            source: p.source,
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

export function useSession(sessionId: string) {
  const [view, setView] = useState<SessionView>(EMPTY);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const socket = new WebSocket(`${proto}://${location.host}/ws?session=${sessionId}`);
    ws.current = socket;

    socket.onopen = () => setView((v) => ({ ...v, connected: true }));
    socket.onclose = () => setView((v) => ({ ...v, connected: false }));

    socket.onmessage = (m) => {
      const f = JSON.parse(m.data);
      setView((v) => {
        if (f.t === "sync") {
          // Replay the whole log; both tabs converge by construction.
          const folded = f.events.reduce(apply, { ...EMPTY, connected: true, you: f.you ?? v.you });
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

    return () => socket.close();
  }, [sessionId]);

  const send = useCallback((intent: Intent) => {
    ws.current?.send(JSON.stringify(intent));
  }, []);

  const clearError = useCallback(() => setView((v) => ({ ...v, error: undefined })), []);

  return { view, send, clearError };
}

/** Live authority (MASS-specs A4), recomputed client-side for affordances only. */
export function perms(view: SessionView) {
  const seats = Object.values(view.seats);
  const t2 = seats.filter((s) => s.tier === "T2" || s.tier === "T3").length;
  const t3 = seats.filter((s) => s.tier === "T3").length;
  return { canDraft: t2 >= 1, canCommit: t3 >= 2, presentT2: t2, presentT3: t3 };
}
