/**
 * Unit tests for the M3 server-side verification gate. No network: we exercise
 * score derivation, config, the HMAC token round-trip (tamper/expiry/key), and
 * the no-network paths of verifyWorldProof (fail-closed + DEV fallback).
 */

import { describe, it, expect } from "vitest";
import {
  deriveSybilScore,
  issueToken,
  sybilThreshold,
  verifyToken,
  verifyWorldProof,
  worldConfigured,
  type VerifyOutcome,
  type WorldEnv,
} from "./verify.js";

const env: WorldEnv = { SESSION_KEY: "test-secret-key" };

const outcome = (over: Partial<VerifyOutcome> = {}): VerifyOutcome => ({
  ok: true,
  nullifierHash: "0xabc",
  credential: "selfie",
  sybilScore: 0.72,
  verifiedAt: Date.now(),
  dev: false,
  raw: null,
  ...over,
});

describe("sybil score derivation", () => {
  it("orders credentials by strength", () => {
    expect(deriveSybilScore("orb")).toBeGreaterThan(deriveSybilScore("selfie"));
    expect(deriveSybilScore("selfie")).toBeGreaterThan(deriveSybilScore("device"));
  });
  it("device is below the default threshold; unknown/absent is neutral", () => {
    expect(deriveSybilScore("device")).toBeLessThan(0.5);
    expect(deriveSybilScore("unknown")).toBe(0.5);
    expect(deriveSybilScore(undefined)).toBe(0.5);
  });
});

describe("threshold + config", () => {
  it("defaults threshold to 0.5 and parses overrides", () => {
    expect(sybilThreshold({})).toBe(0.5);
    expect(sybilThreshold({ WORLD_SYBIL_THRESHOLD: "0.8" })).toBe(0.8);
    expect(sybilThreshold({ WORLD_SYBIL_THRESHOLD: "nonsense" })).toBe(0.5);
  });
  it("worldConfigured needs both app and rp id", () => {
    expect(worldConfigured({})).toBe(false);
    expect(worldConfigured({ WORLD_APP_ID: "app_x" })).toBe(false);
    expect(worldConfigured({ WORLD_APP_ID: "app_x", WORLD_RP_ID: "rp_x" })).toBe(true);
  });
});

describe("verification tokens (HMAC)", () => {
  it("round-trips a selfie token → T2", async () => {
    const token = await issueToken(env, "selfie", outcome(), "sess1");
    const claims = await verifyToken(env, token);
    expect(claims?.kind).toBe("selfie");
    expect(claims?.tier).toBe("T2");
    expect(claims?.nullifierHash).toBe("0xabc");
    expect(claims?.sybilScore).toBe(0.72);
  });

  it("an agentkit token grants T3", async () => {
    const token = await issueToken(env, "agentkit", outcome({ credential: "orb", sybilScore: 0.95 }), "sess1");
    expect((await verifyToken(env, token))?.tier).toBe("T3");
  });

  it("rejects a tampered signature", async () => {
    const token = await issueToken(env, "selfie", outcome(), "sess1");
    const [payload] = token.split(".");
    expect(await verifyToken(env, `${payload}.not-the-signature`)).toBeNull();
  });

  it("rejects a token signed with a different key", async () => {
    const token = await issueToken(env, "selfie", outcome(), "sess1");
    expect(await verifyToken({ SESSION_KEY: "different" }, token)).toBeNull();
  });

  it("rejects an expired token", async () => {
    // verifiedAt far in the past → exp (verifiedAt + TTL) is already past.
    const token = await issueToken(env, "selfie", outcome({ verifiedAt: Date.now() - 60 * 60 * 1000 }), "sess1");
    expect(await verifyToken(env, token)).toBeNull();
  });

  it("refuses to issue a token for a failed verification", async () => {
    await expect(issueToken(env, "selfie", outcome({ ok: false, nullifierHash: null }), "sess1")).rejects.toThrow();
  });

  it("carries the session it was issued for, so another room can reject it", async () => {
    const token = await issueToken(env, "selfie", outcome(), "sess1");
    const claims = await verifyToken(env, token);
    expect(claims?.session).toBe("sess1");
    // The DO compares this against its own session id (see claimSeat): a token
    // minted for sess1 must not seat its holder in sess2.
    expect(claims?.session).not.toBe("sess2");
  });

  it("returns null for garbage tokens", async () => {
    expect(await verifyToken(env, undefined)).toBeNull();
    expect(await verifyToken(env, "")).toBeNull();
    expect(await verifyToken(env, "only-one-part")).toBeNull();
  });
});

describe("verifyWorldProof — no-network paths", () => {
  const proof = (identifier = "selfie", nullifier = "n1") => ({
    responses: [{ identifier, proof: "p", merkle_root: "m", nullifier }],
  });

  it("fails closed when World is unconfigured and DEV is off", async () => {
    const r = await verifyWorldProof({ SESSION_KEY: "k" }, "selfie", proof());
    expect(r.ok).toBe(false);
  });

  it("accepts an explicitly-marked dev proof only when DEV fallback is on", async () => {
    const devEnv: WorldEnv = { SESSION_KEY: "k", WORLD_DEV_FALLBACK: "1" };
    const ok = await verifyWorldProof(devEnv, "selfie", { dev: true, ...proof("selfie", "n1") });
    expect(ok.ok).toBe(true);
    expect(ok.dev).toBe(true);
    expect(ok.sybilScore).toBe(deriveSybilScore("selfie"));

    // Same env, but the proof is NOT marked dev → refused.
    const no = await verifyWorldProof(devEnv, "selfie", proof("selfie", "n2"));
    expect(no.ok).toBe(false);
  });

  it("a weak credential lands below threshold (→ Observer in the DO)", async () => {
    const devEnv: WorldEnv = { SESSION_KEY: "k", WORLD_DEV_FALLBACK: "1" };
    const r = await verifyWorldProof(devEnv, "selfie", { dev: true, ...proof("device", "n3") });
    expect(r.ok).toBe(true);
    expect(r.sybilScore).toBeLessThan(sybilThreshold(devEnv));
  });

  it("rejects an empty proof under a configured app, before any network call", async () => {
    const configured: WorldEnv = { SESSION_KEY: "k", WORLD_APP_ID: "app_x", WORLD_RP_ID: "rp_x" };
    const r = await verifyWorldProof(configured, "selfie", { responses: [] });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/no credential responses/);
  });
});
