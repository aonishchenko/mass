/**
 * The Build Path's one hard rule: readiness is COUNTED, never claimed
 * (STEP-BY-STEP-AGENT-WORKFLOW.md, Part 1 and Part 4).
 */

import { describe, it, expect } from "vitest";
import { BUILD_PATH, nextStep, readiness, stepById } from "./buildPath";

const accepted = (...slots: string[]) => slots.map((slot) => ({ slot }));

describe("the twelve steps", () => {
  it("has exactly twelve, in order, with unique ids", () => {
    expect(BUILD_PATH).toHaveLength(12);
    expect(BUILD_PATH.map((s) => s.order)).toEqual([...Array(12)].map((_, i) => i + 1));
    expect(new Set(BUILD_PATH.map((s) => s.id)).size).toBe(12);
  });

  it("only soul, voice, knowledge and skills earn ownership", () => {
    expect(BUILD_PATH.filter((s) => s.earnsOwnership).map((s) => s.id)).toEqual([
      "soul",
      "voice",
      "knowledge",
      "skills",
    ]);
  });

  it("knowledge is the ongoing one and never 'completes' conceptually", () => {
    expect(stepById("knowledge")?.ongoing).toBe(true);
  });
});

describe("readiness is derived from accepted work", () => {
  it("starts at 0/12 with nothing accepted", () => {
    const { filled, total } = readiness([], 0);
    expect(filled).toBe(0);
    expect(total).toBe(12);
  });

  it("ticks a step only when its threshold is met", () => {
    // Soul needs two; one is not enough.
    expect(readiness(accepted("soul"), 0).steps.find((s) => s.step.id === "soul")!.filled).toBe(
      false
    );
    expect(
      readiness(accepted("soul", "soul"), 0).steps.find((s) => s.step.id === "soul")!.filled
    ).toBe(true);
  });

  it("knowledge needs three", () => {
    const two = readiness(accepted("knowledge", "knowledge"), 0);
    expect(two.steps.find((s) => s.step.id === "knowledge")!.filled).toBe(false);
    const three = readiness(accepted("knowledge", "knowledge", "knowledge"), 0);
    expect(three.steps.find((s) => s.step.id === "knowledge")!.filled).toBe(true);
  });

  it("ignores contributions with no step (freeform work)", () => {
    expect(readiness([{}, {}, {}], 0).filled).toBe(0);
  });

  it("fills ownership from the cap table, not from an answer", () => {
    const nobody = readiness([], 0).steps.find((s) => s.step.id === "ownership")!;
    expect(nobody.filled).toBe(false);
    const someone = readiness([], 1).steps.find((s) => s.step.id === "ownership")!;
    expect(someone.filled).toBe(true);
  });

  it("counts several steps at once and reports the total", () => {
    const { filled } = readiness(accepted("purpose", "skills", "ratecard"), 1);
    // purpose + skills + ratecard + ownership (from the cap table)
    expect(filled).toBe(4);
  });
});

describe("suggested next step", () => {
  it("suggests the first unfilled step, never the derived one", () => {
    expect(nextStep(readiness([], 0).steps)?.id).toBe("purpose");
    expect(nextStep(readiness(accepted("purpose"), 0).steps)?.id).toBe("soul");
  });

  it("suggests nothing once every answerable step is filled", () => {
    const all = BUILD_PATH.filter((s) => !s.derived).flatMap((s) =>
      Array.from({ length: s.needs }, () => ({ slot: s.id }))
    );
    expect(nextStep(readiness(all, 1).steps)).toBeUndefined();
    expect(readiness(all, 1).filled).toBe(12);
  });
});
