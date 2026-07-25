import { describe, expect, it } from "vitest";
import { authorize, computePerms } from "./perms.js";
import { EMPTY_SESSION, type Seat, type Session } from "./types.js";

const seat = (id: string, tier: Seat["tier"], present = true): Seat => ({
  seat: id,
  name: id,
  tier,
  present,
});

const sessionWith = (...seats: Seat[]): Session => ({
  ...EMPTY_SESSION("s1"),
  created: true,
  seats: Object.fromEntries(seats.map((s) => [s.seat, s])),
});

describe("computePerms — MASS-specs A4", () => {
  it("DRAFT needs >=1 T2 present", () => {
    expect(computePerms([seat("a", "T1")]).canDraft).toBe(false);
    expect(computePerms([seat("a", "T2")]).canDraft).toBe(true);
  });

  it("COMMIT needs 2 T3 present", () => {
    expect(computePerms([seat("a", "T3")]).canCommit).toBe(false);
    expect(computePerms([seat("a", "T3"), seat("b", "T3")]).canCommit).toBe(true);
  });

  it("absent seats do not count toward quorum", () => {
    const perms = computePerms([seat("a", "T3"), seat("b", "T3", false)]);
    expect(perms.canCommit).toBe(false);
    expect(perms.presentT3).toBe(1);
  });

  it("last T3 leaving locks COMMIT (complete-then-lock)", () => {
    const both = computePerms([seat("a", "T3"), seat("b", "T3")]);
    expect(both.locked).toBe(false);
    const oneLeft = computePerms([seat("a", "T3"), seat("b", "T3", false)]);
    expect(oneLeft.locked).toBe(true);
    expect(oneLeft.canDraft).toBe(true); // drafting survives; only COMMIT locks
  });

  it("T3 satisfies the T2 draft requirement", () => {
    expect(computePerms([seat("a", "T3")]).canDraft).toBe(true);
  });
});

describe("authorize — lane and tier gating", () => {
  it("T2 cannot trigger a canonical run (§6.1)", () => {
    const s = sessionWith(seat("a", "T2"), seat("b", "T2"));
    const a = s.seats["a"];
    expect(authorize("instruct", a, s, { lane: "draft" }).ok).toBe(true);
    expect(authorize("instruct", a, s, { lane: "canonical" }).ok).toBe(false);
  });

  it("canonical allowed once two signers are present", () => {
    const s = sessionWith(seat("a", "T3"), seat("b", "T3"));
    expect(authorize("instruct", s.seats["a"], s, { lane: "canonical" }).ok).toBe(true);
  });

  it("T2 cannot cosign", () => {
    const s = sessionWith(seat("a", "T2"), seat("b", "T3"), seat("c", "T3"));
    expect(authorize("cosign", s.seats["a"], s).ok).toBe(false);
    expect(authorize("cosign", s.seats["b"], s).ok).toBe(true);
  });

  it("challenge state transition is open to builders", () => {
    const s = sessionWith(seat("a", "T2"));
    expect(authorize("challengeContrib", s.seats["a"], s).ok).toBe(true);
    expect(authorize("challengeContrib", seat("z", "T1"), s).ok).toBe(false);
  });

  it("closeSession is rejected while a harvest is open (§7.5.5)", () => {
    const base = sessionWith(seat("a", "T3"), seat("b", "T3"));
    const s: Session = {
      ...base,
      harvest: { harvestId: "h1", sinceSeq: 0, open: true, keptContribIds: [] },
    };
    expect(authorize("closeSession", s.seats["a"], s).ok).toBe(false);

    const closed: Session = { ...s, harvest: { ...s.harvest!, open: false } };
    expect(authorize("closeSession", closed.seats["a"], closed).ok).toBe(true);
  });

  it("only one harvest may be open at a time", () => {
    const base = sessionWith(seat("a", "T2"));
    const s: Session = {
      ...base,
      harvest: { harvestId: "h1", sinceSeq: 0, open: true, keptContribIds: [] },
    };
    expect(authorize("openHarvest", s.seats["a"], s).ok).toBe(false);
  });

  it("nothing is authorized on a closed session", () => {
    const s: Session = { ...sessionWith(seat("a", "T3")), closed: true };
    expect(authorize("instruct", s.seats["a"], s, { lane: "draft" }).ok).toBe(false);
  });
});
