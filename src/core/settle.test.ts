/**
 * The settlement statement: 70% by use, 30% by ownership, exact to the tinybar,
 * and never claiming a payment was made.
 */

import { describe, it, expect } from "vitest";
import { settle, toHbar } from "./settle.js";

const HBAR = 100_000_000n;

const base = {
  amountTinybar: 100n * HBAR,
  // This job leaned entirely on alice's knowledge.
  usage: { alice: 1 },
  // Both hold an equal share of what the agent has been taught.
  capTable: { alice: 1, bob: 1 },
  names: { alice: "alice.mass.eth", bob: "bob.mass.eth" },
};

describe("settlement", () => {
  it("never claims a payment happened", () => {
    expect(settle(base).executed).toBe(false);
  });

  it("splits 70 by use and 30 by ownership", () => {
    const s = settle(base);
    const alice = s.lines.find((l) => l.seat === "alice")!;
    const bob = s.lines.find((l) => l.seat === "bob")!;

    // alice: the whole use pot (70) + half the ownership pot (15) = 85
    expect(alice.amountTinybar).toBe(85n * HBAR);
    // bob: taught nothing this job, still owns half of 30 = 15
    expect(bob.amountTinybar).toBe(15n * HBAR);
  });

  it("shows WHY each person earned what they did", () => {
    const alice = settle(base).lines.find((l) => l.seat === "alice")!;
    expect(alice.fromUse).toBe(70n * HBAR);
    expect(alice.fromOwnership).toBe(15n * HBAR);
  });

  it("pays out to nobody, and holds it, when no account is linked", () => {
    const s = settle(base);
    expect(s.lines.every((l) => l.status === "held-no-account")).toBe(true);
    // Held, never absorbed: the whole amount is still accounted for.
    expect(s.heldTinybar).toBe(100n * HBAR);
  });

  it("marks a share payable once that person has linked an account", () => {
    const s = settle({ ...base, accounts: { alice: "0.0.1001" } });
    expect(s.lines.find((l) => l.seat === "alice")!.status).toBe("payable");
    expect(s.lines.find((l) => l.seat === "bob")!.status).toBe("held-no-account");
  });

  it("still pays owners when a job used nothing at all", () => {
    const s = settle({ ...base, usage: {} });
    // With no use recorded the whole amount follows ownership, 50/50.
    const alice = s.lines.find((l) => l.seat === "alice")!;
    const bob = s.lines.find((l) => l.seat === "bob")!;
    expect(alice.amountTinybar).toBe(bob.amountTinybar);
  });

  it("orders the statement by who earned most", () => {
    const s = settle(base);
    expect(s.lines[0].seat).toBe("alice");
  });

  it("renders tinybar as hbar for display only", () => {
    expect(toHbar(100n * HBAR)).toBe("100.0000");
  });
});

describe("a statement has to add up to the job it describes", () => {
  // Every one of these lost tinybar before the lines were taken from the
  // splitter's own breakdown: two independent divisions of the same pot
  // disagree by the remainder, and the no-usage case lost the entire 70%.
  const cases: { what: string; amountTinybar: bigint; usage: Record<string, number> }[] = [
    { what: "a clean amount", amountTinybar: 100n * HBAR, usage: { alice: 1 } },
    { what: "an amount that does not divide", amountTinybar: 1n * HBAR + 7n, usage: { alice: 1, bob: 2 } },
    { what: "floor-only weights", amountTinybar: 33_333_333n, usage: { alice: 0.15, bob: 0.15 } },
    { what: "a job that cited nothing", amountTinybar: 100n * HBAR, usage: {} },
  ];

  for (const c of cases) {
    it(`reconciles exactly: ${c.what}`, () => {
      const s = settle({ ...base, amountTinybar: c.amountTinybar, usage: c.usage });
      const sum = s.lines.reduce((t, l) => t + l.amountTinybar, 0n);
      expect(sum).toBe(c.amountTinybar);
      // Nothing is payable yet, so everything must be held — not absorbed.
      expect(s.heldTinybar).toBe(c.amountTinybar);
    });

    it(`explains every tinybar it pays: ${c.what}`, () => {
      const s = settle({ ...base, amountTinybar: c.amountTinybar, usage: c.usage });
      for (const l of s.lines) {
        expect(l.fromUse + l.fromOwnership).toBe(l.amountTinybar);
      }
    });
  }

  it("pays out the use pot through ownership when a job cited nothing", () => {
    // The splitter folds the unclaimed use pot into ownership rather than
    // stranding it; the statement has to say the same thing.
    const s = settle({ ...base, usage: {} });
    expect(s.lines.reduce((t, l) => t + l.fromUse, 0n)).toBe(0n);
    expect(s.lines.reduce((t, l) => t + l.fromOwnership, 0n)).toBe(100n * HBAR);
  });
});
