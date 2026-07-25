import { describe, expect, it } from "vitest";
import { append, apply, capTable, replay } from "./reduce.js";
import { canonicalJson } from "./ids.js";
import { EMPTY_SESSION, type MassEvent, type Session } from "./types.js";

let seq = 0;
const ev = <P>(type: MassEvent["type"], payload: P, actor?: MassEvent["actor"]): MassEvent<P> => ({
  id: `e${++seq}`,
  seq,
  ts: 1_700_000_000_000 + seq,
  type,
  actor: actor ?? { system: true },
  payloadHash: "hash",
  payload,
});

const bootstrap = (): MassEvent[] => {
  seq = 0;
  return [
    ev("session.created", {}),
    ev("seat.claimed", { seat: "s_a", name: "alice", tier: "T1" }),
    ev("seat.claimed", { seat: "s_b", name: "bob", tier: "T1" }),
    ev("verify.selfie.ok", { seat: "s_a", sybilScore: 0.9, attestationHash: "x" }),
    ev("verify.selfie.ok", { seat: "s_b", sybilScore: 0.8, attestationHash: "y" }),
    ev("verify.agentkit.ok", { seat: "s_a" }),
    ev("verify.agentkit.ok", { seat: "s_b" }),
  ];
};

const accept = (contribId: string, seat: string, n: number, text: string): MassEvent[] => [
  ev("contrib.proposed", { contribId, text, source: "composer" }, { seat, tier: "T3" }),
  ev("contrib.cosigned", { contribId, seat: "s_a", count: 1 }, { seat: "s_a", tier: "T3" }),
  ev("contrib.cosigned", { contribId, seat: "s_b", count: 2 }, { seat: "s_b", tier: "T3" }),
  ev("contrib.accepted", { contribId, seat, contribNumber: n, text }),
];

describe("replay — shared-session-spec §4", () => {
  it("folding the same log twice gives identical state", () => {
    const events = [...bootstrap(), ...accept("c1", "s_a", 1, "indemnity cap is 12 months")];
    const a = replay(EMPTY_SESSION("s1"), events);
    const b = replay(EMPTY_SESSION("s1"), events);
    expect(canonicalJson(a)).toBe(canonicalJson(b));
  });

  it("a late joiner folding the log matches an incrementally built session", () => {
    const events = [...bootstrap(), ...accept("c1", "s_a", 1, "rule one")];
    const incremental = events.reduce(append, EMPTY_SESSION("s1"));
    const lateJoiner = replay(EMPTY_SESSION("s1"), incremental.events);
    expect(canonicalJson(lateJoiner)).toBe(canonicalJson(incremental));
  });

  it("apply is pure — it never mutates the input state", () => {
    const s = replay(EMPTY_SESSION("s1"), bootstrap());
    const snapshot = canonicalJson(s);
    apply(s, ev("seat.left", { seat: "s_a" }));
    expect(canonicalJson(s)).toBe(snapshot);
  });

  it("verification promotes tier through the fold", () => {
    const s = replay(EMPTY_SESSION("s1"), bootstrap());
    expect(s.seats["s_a"].tier).toBe("T3");
    expect(s.seats["s_a"].sybilScore).toBe(0.9);
  });
});

describe("cap table — MASS-specs C1", () => {
  it("counts contrib.accepted per seat and nothing else", () => {
    const events = [
      ...bootstrap(),
      ...accept("c1", "s_a", 1, "one"),
      ...accept("c2", "s_a", 2, "two"),
      ...accept("c3", "s_b", 1, "three"),
    ];
    const s = replay(EMPTY_SESSION("s1"), events);
    expect(capTable(s)).toEqual({ s_a: 2, s_b: 1 });
  });

  it("instructions and draft answers earn nothing", () => {
    const events = [
      ...bootstrap(),
      ev("instruct", { instructId: "i1", text: "hi", lane: "draft" }, { seat: "s_a", tier: "T3" }),
      ev("draft.started", { runId: "r1", lane: "draft", instructId: "i1" }, { agent: true }),
      ev("draft.completed", { runId: "r1", lane: "draft", text: "hello" }, { agent: true }),
    ];
    const s = replay(EMPTY_SESSION("s1"), events);
    expect(capTable(s)).toEqual({});
    expect(s.brainChunks).toHaveLength(0);
  });

  it("draft output never reaches the brain", () => {
    const events = [
      ...bootstrap(),
      ev("draft.completed", { runId: "r1", lane: "draft", text: "model prose" }, { agent: true }),
      ...accept("c1", "s_a", 1, "human knowledge"),
    ];
    const s = replay(EMPTY_SESSION("s1"), events);
    expect(s.brainChunks.map((c) => c.content)).toEqual(["human knowledge"]);
  });
});

describe("brain chunks — C2 citation material", () => {
  it("carries contributor name and per-contributor number", () => {
    const events = [...bootstrap(), ...accept("c1", "s_a", 1, "rule"), ...accept("c2", "s_a", 2, "rule2")];
    const s = replay(EMPTY_SESSION("s1"), events);
    expect(s.brainChunks[1]).toMatchObject({
      contributor: "alice",
      contribNumber: 2,
      chunkId: "c2",
    });
  });

  it("flagged screening rejects the contribution", () => {
    const events = [
      ...bootstrap(),
      ev("contrib.proposed", { contribId: "c1", text: "bad", source: "composer" }, { seat: "s_a", tier: "T3" }),
      ev("contrib.screened", { contribId: "c1", verdict: "flagged" }),
    ];
    const s = replay(EMPTY_SESSION("s1"), events);
    expect(s.contributions["c1"].state).toBe("rejected");
  });

  it("duplicate cosigns from one seat do not double-count", () => {
    const events = [
      ...bootstrap(),
      ev("contrib.proposed", { contribId: "c1", text: "x", source: "composer" }, { seat: "s_a", tier: "T3" }),
      ev("contrib.cosigned", { contribId: "c1", seat: "s_a", count: 1 }, { seat: "s_a", tier: "T3" }),
      ev("contrib.cosigned", { contribId: "c1", seat: "s_a", count: 1 }, { seat: "s_a", tier: "T3" }),
    ];
    const s = replay(EMPTY_SESSION("s1"), events);
    expect(s.contributions["c1"].cosigners).toEqual(["s_a"]);
  });
});

describe("harvest — §7.5", () => {
  it("cancelling does not advance sinceSeq, so nothing is lost", () => {
    const events: MassEvent[] = [
      ...bootstrap(),
      ev("harvest.opened", { harvestId: "h1", sinceSeq: 3, candidateCount: 4 }),
      ev("harvest.cancelled", { harvestId: "h1" }),
    ];
    const s = replay(EMPTY_SESSION("s1"), events);
    expect(s.harvest?.open).toBe(false);
    expect(s.lastHarvestedSeq).toBe(0);
  });

  it("closing advances lastHarvestedSeq", () => {
    const events: MassEvent[] = [
      ...bootstrap(),
      ev("harvest.opened", { harvestId: "h1", sinceSeq: 3, candidateCount: 4 }),
      ev("harvest.closed", { harvestId: "h1", kept: ["c1"], dropped: 3, lastSeq: 12 }),
    ];
    const s = replay(EMPTY_SESSION("s1"), events);
    expect(s.lastHarvestedSeq).toBe(12);
  });

  it("harvested contributions earn cap-table shares like live ones", () => {
    const s: Session = replay(EMPTY_SESSION("s1"), [
      ...bootstrap(),
      ev("harvest.opened", { harvestId: "h1", sinceSeq: 3, candidateCount: 2 }),
      ev("contrib.proposed", { contribId: "c1", text: "a", source: "harvest", harvestId: "h1" }, { seat: "s_a", tier: "T3" }),
      ev("contrib.cosigned", { contribId: "c1", seat: "s_a", count: 1 }, { seat: "s_a", tier: "T3" }),
      ev("contrib.cosigned", { contribId: "c1", seat: "s_b", count: 2 }, { seat: "s_b", tier: "T3" }),
      ev("contrib.accepted", { contribId: "c1", seat: "s_a", contribNumber: 1, text: "a" }),
      ev("harvest.closed", { harvestId: "h1", kept: ["c1"], dropped: 1, lastSeq: 12 }),
    ]);
    expect(capTable(s)).toEqual({ s_a: 1 });
    expect(s.contributions["c1"].source).toBe("harvest");
  });
});
