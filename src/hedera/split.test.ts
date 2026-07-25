import { describe, expect, it } from "vitest";
import {
  AUTHORSHIP_BPS,
  DEFAULT_DUST,
  reconciles,
  splitPayment,
  type SplitInput,
} from "./split.js";

const HBAR = 100_000_000n;

const base: SplitInput = {
  amountTinybar: 10n * HBAR,
  citations: [
    { file: "skills/release-notes.md", lineStart: 1, lineEnd: 8, seat: "alice" },
    { file: "skills/release-notes.md", lineStart: 12, lineEnd: 20, seat: "alice" },
    { file: "values.md", lineStart: 3, lineEnd: 4, seat: "bob" },
  ],
  capTable: { alice: 2, bob: 1, carol: 1 },
  accounts: { alice: "0.0.1001", bob: "0.0.1002", carol: "0.0.1003" },
};

describe("splitPayment — hedera-spec §5.2", () => {
  it("reconciles exactly: paid + pooled == total", () => {
    const r = splitPayment(base);
    expect(reconciles(r)).toBe(true);
  });

  it("never loses or invents tinybars to rounding", () => {
    // 7 is deliberately indivisible by the weights.
    const r = splitPayment({ ...base, amountTinybar: 7n * HBAR + 3n });
    const paid = r.transfers.reduce((n, t) => n + t.amountTinybar, 0n);
    expect(paid + r.pooledRemainder).toBe(7n * HBAR + 3n);
  });

  it("weights the authorship share by citation count", () => {
    const r = splitPayment(base);
    const alice = r.transfers.find((t) => t.seat === "alice")!;
    const bob = r.transfers.find((t) => t.seat === "bob")!;
    // alice: 2 of 3 citations + 2 of 4 cap-table units; bob: 1 and 1.
    expect(alice.amountTinybar).toBeGreaterThan(bob.amountTinybar);
  });

  it("pays cap-table holders who were never cited", () => {
    const r = splitPayment(base);
    // carol authored nothing this job but holds a share.
    expect(r.transfers.find((t) => t.seat === "carol")).toBeDefined();
  });

  it("splits 70/30 between citations and holders", () => {
    const onlyAliceCited: SplitInput = {
      ...base,
      citations: [{ file: "a.md", lineStart: 1, lineEnd: 2, seat: "alice" }],
      capTable: { bob: 1 },
      accounts: { alice: "0.0.1001", bob: "0.0.1002" },
    };
    const r = splitPayment(onlyAliceCited);
    const alice = r.transfers.find((t) => t.seat === "alice")!;
    const bob = r.transfers.find((t) => t.seat === "bob")!;
    expect(alice.amountTinybar).toBe((base.amountTinybar * AUTHORSHIP_BPS) / 10_000n);
    expect(alice.amountTinybar + bob.amountTinybar).toBe(base.amountTinybar);
  });

  it("pools dust rather than paying more in fees than it transfers", () => {
    const many: Record<string, number> = {};
    const accounts: Record<string, string> = {};
    for (let i = 0; i < 50; i++) {
      many[`seat${i}`] = 1;
      accounts[`seat${i}`] = `0.0.${2000 + i}`;
    }
    const r = splitPayment({
      amountTinybar: 1n * HBAR, // 1 HBAR across 50 seats = 0.02 each
      citations: [],
      capTable: many,
      accounts,
    });
    expect(r.transfers).toHaveLength(0);
    expect(r.pooledRemainder).toBe(1n * HBAR);
    expect(reconciles(r)).toBe(true);
  });

  it("pools the share of a seat with no Hedera account", () => {
    const r = splitPayment({ ...base, accounts: { alice: "0.0.1001", bob: undefined } });
    expect(r.transfers.map((t) => t.seat)).not.toContain("bob");
    expect(r.pooledRemainder).toBeGreaterThan(0n);
    expect(reconciles(r)).toBe(true);
  });

  it("falls back to the cap table when a job cited nothing", () => {
    const r = splitPayment({ ...base, citations: [] });
    // The authorship pot must not be stranded.
    expect(reconciles(r)).toBe(true);
    const paid = r.transfers.reduce((n, t) => n + t.amountTinybar, 0n);
    expect(paid + r.pooledRemainder).toBe(base.amountTinybar);
  });

  it("dust threshold is 0.1 HBAR", () => {
    expect(DEFAULT_DUST).toBe(10_000_000n);
  });

  it("scripted log produces the expected allocation", () => {
    // Two accepted contributions from alice, one from bob; the job cited only
    // alice's file. Expected: alice takes all authorship + half the holder pot.
    const r = splitPayment({
      amountTinybar: 100n * HBAR,
      citations: [{ file: "skills/x.md", lineStart: 1, lineEnd: 5, seat: "alice" }],
      capTable: { alice: 1, bob: 1 },
      accounts: { alice: "0.0.1001", bob: "0.0.1002" },
    });
    const byseat = Object.fromEntries(r.transfers.map((t) => [t.seat, t.amountTinybar]));
    expect(byseat["alice"]).toBe(70n * HBAR + 15n * HBAR); // 70% + half of 30%
    expect(byseat["bob"]).toBe(15n * HBAR);
    expect(reconciles(r)).toBe(true);
  });
});
