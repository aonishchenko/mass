/**
 * M3 World mock — deterministic, 300ms, logged (MASS-specs C4).
 * Real server-side verification is the M3 hard gate and replaces this.
 */

const delay = <T>(value: T, ms = 300): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

/** Stable pseudo-score so replays and demos are reproducible. */
function scoreFor(seat: string): number {
  let h = 0;
  for (const ch of seat) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return Number((0.7 + (h % 30) / 100).toFixed(2));
}

export async function verifySelfie(seat: string) {
  console.log("[world.mock] verifySelfie", seat);
  return delay({ ok: true, attestationHash: `mock_selfie_${seat}`, sybilScore: scoreFor(seat) });
}

export async function verifyAgentKit(seat: string) {
  console.log("[world.mock] verifyAgentKit", seat);
  return delay({ ok: true, proofRef: `mock_orb_${seat}` });
}

export async function verifyContinuity(seat: string, covers?: string[]) {
  console.log("[world.mock] verifyContinuity", seat, covers?.length ?? 1);
  return delay({ ok: true });
}

/**
 * Brain immune system (B2.2) — screens a proposed contribution before acceptance.
 * Mock flags only obvious junk so the demo path is predictable.
 */
export async function mockScreen(text: string) {
  console.log("[world.mock] screenContribution", text.slice(0, 40));
  const flagged = text.trim().length < 3;
  return delay({
    verdict: flagged ? ("flagged" as const) : ("pass" as const),
    attestationRef: `mock_screen_${flagged ? "flag" : "pass"}`,
  });
}
