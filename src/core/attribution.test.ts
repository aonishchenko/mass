/**
 * The guarantee under the money: attribution can only ever credit knowledge we
 * actually put in front of the model. A citation the model invented must earn
 * nobody anything.
 */

import { describe, it, expect } from "vitest";
import {
  FLOOR,
  citedChunkIds,
  markerFor,
  stripMarkers,
  usageBySeat,
  usageLines,
  usageWeights,
} from "./attribution.js";
import type { BrainChunk } from "./types.js";

const chunk = (chunkId: string, contributor: string): BrainChunk => ({
  chunkId,
  contributor,
  contribNumber: 1,
  content: "…",
  screened: true,
});

const candidates = [chunk("c_alice1", "alice.eth"), chunk("c_bob1", "bob.eth")];
const seatOf = { c_alice1: "seat_alice", c_bob1: "seat_bob" };

describe("citation extraction", () => {
  it("finds the markers the model echoed back", () => {
    const answer = `Show the credential shape ${markerFor("c_alice1")} early.`;
    expect(citedChunkIds(answer, candidates)).toEqual(["c_alice1"]);
  });

  it("DISCARDS ids that were never offered to the model", () => {
    // The heart of it: a hallucinated or copied id cannot earn money.
    const answer = `Trust me ${markerFor("c_doesnotexist")} and ${markerFor("c_alice1")}.`;
    expect(citedChunkIds(answer, candidates)).toEqual(["c_alice1"]);
  });

  it("deduplicates and preserves first-appearance order", () => {
    const answer = `${markerFor("c_bob1")} … ${markerFor("c_alice1")} … ${markerFor("c_bob1")}`;
    expect(citedChunkIds(answer, candidates)).toEqual(["c_bob1", "c_alice1"]);
  });

  it("returns nothing for an answer with no markers", () => {
    expect(citedChunkIds("A perfectly ordinary sentence.", candidates)).toEqual([]);
  });

  it("hides markers from the reader", () => {
    expect(stripMarkers(`Do the thing ${markerFor("c_alice1")} today.`)).toBe(
      "Do the thing today."
    );
  });
});

describe("usage weighting (hybrid: cited full, retrieved floor)", () => {
  it("gives a cited chunk full weight and an uncited one the floor", () => {
    const w = usageWeights(`… ${markerFor("c_alice1")} …`, candidates);
    expect(w.c_alice1).toBe(1);
    expect(w.c_bob1).toBe(FLOOR);
  });

  it("gives everything the floor when the model cited nothing", () => {
    // The answer came from somewhere; the retrieved set is that somewhere.
    const w = usageWeights("no markers here", candidates);
    expect(w.c_alice1).toBe(FLOOR);
    expect(w.c_bob1).toBe(FLOOR);
  });

  it("means a cited contributor always out-earns an uncited one", () => {
    const bySeat = usageBySeat(`… ${markerFor("c_alice1")} …`, candidates, seatOf);
    expect(bySeat.seat_alice).toBeGreaterThan(bySeat.seat_bob);
  });

  it("credits nobody for a chunk with no credited seat", () => {
    const bySeat = usageBySeat(`… ${markerFor("c_alice1")} …`, candidates, {
      c_alice1: "seat_alice",
    });
    expect(bySeat.seat_alice).toBe(1);
    expect(Object.keys(bySeat)).toEqual(["seat_alice"]);
  });

  it("aggregates several chunks from the same person", () => {
    const many = [...candidates, chunk("c_alice2", "alice.eth")];
    const bySeat = usageBySeat(
      `${markerFor("c_alice1")} ${markerFor("c_alice2")}`,
      many,
      { ...seatOf, c_alice2: "seat_alice" }
    );
    expect(bySeat.seat_alice).toBe(2);
  });
});

describe("usage lines (the receipt a contributor can check)", () => {
  it("says of each chunk whether it was cited and what it earned", () => {
    const lines = usageLines(`… ${markerFor("c_alice1")} …`, candidates, seatOf);
    expect(lines).toHaveLength(2);
    expect(lines.find((l) => l.chunkId === "c_alice1")).toMatchObject({
      cited: true,
      weight: 1,
      contributor: "alice.eth",
    });
    expect(lines.find((l) => l.chunkId === "c_bob1")).toMatchObject({
      cited: false,
      weight: FLOOR,
    });
  });
});
