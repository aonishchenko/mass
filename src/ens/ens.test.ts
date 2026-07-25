/**
 * Unit tests for the M5 ENS module — pure logic (no network): label
 * normalization + uniqueness, sybil banding, agent-profile assembly from session
 * state, text-record shaping, and the dev-fallback resolution path.
 */

import { describe, it, expect } from "vitest";
import {
  agentName,
  agentTextRecords,
  assembleAgentProfile,
  ensConfigured,
  joinName,
  resolveName,
  sybilBand,
  toLabel,
  uniqueSeatLabel,
  type EnsEnv,
} from "./ens.js";
import { EMPTY_SESSION, type MassEvent, type Session } from "../core/types.js";

const env: EnsEnv = { ENS_PARENT_NAME: "mass.eth" };

describe("label normalization", () => {
  it("lowercases, hyphenates spaces, strips invalid chars and accents", () => {
    expect(toLabel("Alice")).toBe("alice");
    expect(toLabel("Bob Smith")).toBe("bob-smith");
    expect(toLabel("Niek van der Voort")).toBe("niek-van-der-voort");
    expect(toLabel("José!")).toBe("jose");
    expect(toLabel("  ~~  ")).toBe("anon");
  });
  it("builds names under the parent", () => {
    expect(joinName("alice", env)).toBe("alice.mass.eth");
    expect(agentName(env)).toBe("docs.mass.eth");
    expect(agentName({ ...env, ENS_AGENT_LABEL: "writer" })).toBe("writer.mass.eth");
  });
});

describe("unique seat labels", () => {
  it("disambiguates collisions deterministically", () => {
    const taken = new Set<string>();
    const a = uniqueSeatLabel("Alice", taken); taken.add(a);
    const b = uniqueSeatLabel("alice", taken); taken.add(b);
    const c = uniqueSeatLabel("ALICE", taken);
    expect([a, b, c]).toEqual(["alice", "alice-2", "alice-3"]);
  });
});

describe("sybil banding (never expose the raw score)", () => {
  it("maps score to a band", () => {
    expect(sybilBand(0.95)).toBe("high");
    expect(sybilBand(0.72)).toBe("medium");
    expect(sybilBand(0.4)).toBe("low");
    expect(sybilBand(undefined)).toBe("low");
  });
});

function sessionWith(accepted: Array<{ seat: string }>): Session {
  const s = EMPTY_SESSION("sess1");
  s.seats = {
    s1: { seat: "s1", name: "Alice", tier: "T3", present: true, ensName: "alice.mass.eth" },
    s2: { seat: "s2", name: "Bob", tier: "T2", present: true, ensName: "bob.mass.eth" },
  };
  s.events = accepted.map((a, i) => ({
    id: `e${i}`,
    seq: i + 1,
    ts: i,
    type: "contrib.accepted",
    actor: { system: true },
    payloadHash: "h",
    payload: { seat: a.seat, contribNumber: 1, contribId: `c${i}`, text: "x" },
  })) as MassEvent[];
  return s;
}

describe("agent profile assembly", () => {
  it("derives owners, shares, and counts from the cap-table fold", () => {
    const session = sessionWith([{ seat: "s1" }, { seat: "s1" }, { seat: "s1" }, { seat: "s2" }]);
    session.brainRoot = "0groot";
    const p = assembleAgentProfile(session, { ...env, HEDERA_TOPIC_ID: "0.0.123" });

    expect(p.name).toBe("docs.mass.eth");
    expect(p.contributionCount).toBe(4);
    expect(p.crewSize).toBe(2);
    // Owners sorted by contributions; resolve to ENS names; shares in bps.
    expect(p.owners[0]).toMatchObject({ name: "alice.mass.eth", contributions: 3, shareBps: 7500 });
    expect(p.owners[1]).toMatchObject({ name: "bob.mass.eth", contributions: 1, shareBps: 2500 });
    expect(p.brainRoot).toBe("0groot");
    expect(p.hcsTopic).toBe("0.0.123");
    expect(p.availability).toBe("in-session"); // not closed
  });

  it("marks the agent for-hire once the session is closed", () => {
    const session = sessionWith([{ seat: "s1" }]);
    session.closed = true;
    expect(assembleAgentProfile(session, env).availability).toBe("for-hire");
  });

  it("text records include present fields and omit absent ones", () => {
    const p = assembleAgentProfile(sessionWith([{ seat: "s1" }]), env);
    const rec = agentTextRecords(p);
    expect(rec["com.mass.role"]).toBeDefined();
    expect(rec["com.mass.owners"]).toContain("alice.mass.eth:10000");
    expect(rec.url).toBe("/cv/docs.mass.eth");
    expect(rec["com.mass.brainRoot"]).toBeUndefined(); // no brain root set
  });
});

describe("resolution", () => {
  it("ensConfigured needs a parent name and an L1 RPC", () => {
    expect(ensConfigured({ ENS_PARENT_NAME: "mass.eth" })).toBe(false);
    expect(ensConfigured({ ENS_PARENT_NAME: "mass.eth", ENS_L1_RPC: "https://rpc" })).toBe(true);
  });

  it("dev fallback resolves deterministically and never errors", async () => {
    const r = await resolveName({ ENS_DEV_FALLBACK: "1" }, "alice.mass.eth");
    expect(r.dev).toBe(true);
    expect(r.verified).toBe(true);
    const again = await resolveName({ ENS_DEV_FALLBACK: "1" }, "alice.mass.eth");
    expect(again.address).toBe(r.address); // deterministic
  });

  it("returns an unconfigured error when neither real nor dev is set", async () => {
    const r = await resolveName({}, "alice.mass.eth");
    expect(r.verified).toBe(false);
    expect(r.error).toBeDefined();
  });
});
