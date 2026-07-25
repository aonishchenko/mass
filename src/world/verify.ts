/**
 * M3 World — SERVER-SIDE proof verification (MASS-specs A4 hard gate).
 *
 * This replaces the browser-only path: a client can never assert
 * `verified: true`. Every proof is POSTed to World's cloud verify API from the
 * server here; only on a genuine success do we mint an HMAC-signed session token
 * that the Durable Object will trust (see verifyToken + session-do claimSeat).
 *
 * Docs: https://docs.world.org/world-id/reference/api  (v4 verify)
 *       https://docs.world.org/world-id/credentials/11 (Selfie Check, beta)
 * Integration friction is logged as we go in docs/world-testing.md.
 */

// ---------------------------------------------------------------------------
// Env (narrow slice — kept here so this module has no import cycle with the DO)
// ---------------------------------------------------------------------------

export interface WorldEnv {
  /** app_… from the Developer Portal. Public. */
  WORLD_APP_ID?: string;
  /** rp_… — the path param of the v4 verify endpoint. Public. */
  WORLD_RP_ID?: string;
  /** Override the verify base. Default: World production v4. */
  WORLD_VERIFY_URL?: string;
  /** Action id gating the Builder (Selfie Check) proof. */
  WORLD_ACTION_SELFIE?: string;
  /** Action id gating the Signer (Orb / AgentKit delegation) proof. */
  WORLD_ACTION_AGENTKIT?: string;
  /** production | staging | sandbox. Default production. */
  WORLD_ENV?: string;
  /** Below this, a seat is granted Observer only. Default 0.5. */
  WORLD_SYBIL_THRESHOLD?: string;
  /** ECDSA signing key (hex) used to sign rp_context. SECRET. */
  WORLD_RP_PRIVATE_KEY?: string;
  /**
   * "1" allows an explicitly-marked DEV proof to pass WHEN no real app is
   * configured. Never active once WORLD_APP_ID + WORLD_RP_ID are set.
   */
  WORLD_DEV_FALLBACK?: string;
  WORLD_SELFIE_PRESET?: string;
  /** HMAC secret for session tokens (already used for 0G first-party crypto). */
  SESSION_KEY?: string;
}

export type VerifyKind = "selfie" | "agentkit";

/** One World ID 3.0 (legacy) credential response — matches IDKit ResponseItemV3. */
export interface V3Response {
  identifier: string;
  proof: string;
  merkle_root: string;
  nullifier: string;
  signal_hash?: string;
}

/** onSuccess payload from IDKit legacy presets (IDKitResultV3), plus a dev flag. */
export interface WorldProof {
  protocol_version?: string;
  nonce?: string;
  action?: string;
  environment?: string;
  responses?: V3Response[];
  /** DEV FALLBACK marker only — ignored once a real app is configured. */
  dev?: boolean;
}

export interface VerifyOutcome {
  ok: boolean;
  nullifierHash: string | null;
  credential: string | null;
  sybilScore: number;
  verifiedAt: number;
  /** True only when the DEV fallback issued this — surfaced honestly in the UI. */
  dev: boolean;
  error?: string;
  /** Sanitized verify response, for the booth-showable log. */
  raw: unknown;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/** A real World app requires both an app id and an rp id. */
export function worldConfigured(env: WorldEnv): boolean {
  return Boolean(env.WORLD_APP_ID && env.WORLD_RP_ID);
}

function verifyBase(env: WorldEnv): string {
  return (env.WORLD_VERIFY_URL ?? "https://developer.world.org/api/v4/verify").replace(/\/$/, "");
}

export function actionFor(env: WorldEnv, kind: VerifyKind): string {
  return kind === "selfie"
    ? env.WORLD_ACTION_SELFIE ?? "mass-selfie"
    : env.WORLD_ACTION_AGENTKIT ?? "mass-agentkit";
}

export function sybilThreshold(env: WorldEnv): number {
  const n = Number(env.WORLD_SYBIL_THRESHOLD);
  return Number.isFinite(n) ? n : 0.5;
}

/**
 * World's Selfie Check exposes NO numeric uniqueness/sybil score (its own docs
 * rate sybil resistance only as "Some"). We derive a score BAND from the
 * strength of the credential actually returned, so a weaker credential yields a
 * lower score and can be gated. If World ever returns a numeric score, prefer
 * it. This limitation is logged bluntly in docs/world-testing.md (25% rubric).
 */
const SCORE_BY_CREDENTIAL: Record<string, number> = {
  orb: 0.95,
  proof_of_human: 0.95,
  secure_document: 0.85,
  passport: 0.85,
  document: 0.78,
  selfie: 0.72,
  face: 0.72,
  device: 0.4,
};

export function deriveSybilScore(identifier?: string | null): number {
  if (!identifier) return 0.5;
  return SCORE_BY_CREDENTIAL[identifier.toLowerCase()] ?? 0.5;
}

// ---------------------------------------------------------------------------
// The hard gate — verify a proof against World, server-side
// ---------------------------------------------------------------------------

export async function verifyWorldProof(
  env: WorldEnv,
  kind: VerifyKind,
  proof: WorldProof | null | undefined
,
  envOverride?: string
): Promise<VerifyOutcome> {
  const verifiedAt = Date.now();
  const fail = (error: string, raw: unknown = null): VerifyOutcome => ({
    ok: false,
    nullifierHash: null,
    credential: null,
    sybilScore: 0,
    verifiedAt,
    dev: false,
    error,
    raw,
  });

  if (!proof) return fail("missing proof");

  // DEV BYPASS: requires the server secret WORLD_DEV_FALLBACK=1 AND an
  // explicitly dev-marked proof. A client can never grant itself this — the
  // secret is the gate.
  //
  // Checked BEFORE worldConfigured on purpose. It used to sit inside the
  // "no app configured" branch, which made the bypass unreachable the moment
  // the portal was wired — exactly when a broken World path most needs a way
  // to keep rehearsing. Every such result is marked dev:true and the UI shows
  // the amber banner. MUST be unset for judging.
  if (env.WORLD_DEV_FALLBACK === "1" && proof.dev === true) {
    const cred = proof.responses?.[0]?.identifier ?? (kind === "agentkit" ? "orb" : "selfie");
    const nullifier = proof.responses?.[0]?.nullifier ?? `dev_${kind}_${cred}`;
    return {
      ok: true,
      nullifierHash: nullifier,
      credential: cred,
      sybilScore: deriveSybilScore(cred),
      verifiedAt,
      dev: true,
      raw: { dev: true, note: "DEV BYPASS — proof NOT verified against World" },
    };
  }

  if (!worldConfigured(env)) {
    return fail("World not configured (set WORLD_APP_ID and WORLD_RP_ID)");
  }

  const action = actionFor(env, kind);
  const responses = (proof.responses ?? []).map((r) => ({
    identifier: r.identifier,
    proof: r.proof,
    merkle_root: r.merkle_root,
    nullifier: r.nullifier,
    ...(r.signal_hash ? { signal_hash: r.signal_hash } : {}),
  }));
  if (responses.length === 0) return fail("proof has no credential responses");

  const url = `${verifyBase(env)}/${env.WORLD_RP_ID}`;
  const body = {
    protocol_version: proof.protocol_version ?? "3.0",
    nonce: proof.nonce,
    action,
    environment: envOverride ?? proof.environment ?? env.WORLD_ENV ?? "production",
    responses,
  };

  let status = 0;
  let json: Record<string, unknown>;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    status = res.status;
    json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  } catch (err) {
    return fail(`verify request failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  const success = status >= 200 && status < 300 && json.success === true;
  const results = Array.isArray(json.results) ? (json.results as Array<Record<string, unknown>>) : [];
  const first = results[0] ?? {};
  const credential =
    (first.identifier as string | undefined) ?? responses[0]?.identifier ?? null;
  const nullifierHash =
    (json.nullifier as string | undefined) ??
    (first.nullifier as string | undefined) ??
    responses[0]?.nullifier ??
    null;

  return {
    ok: success,
    nullifierHash: success ? nullifierHash : null,
    credential,
    sybilScore: success ? deriveSybilScore(credential) : 0,
    verifiedAt,
    dev: false,
    error: success
      ? undefined
      : String(
          json.detail ??
            json.code ??
            `World rejected the proof (HTTP ${status}) for environment "${body.environment}", action "${action}". An empty 403 usually means the action does not exist in the Developer Portal, or the app is not approved for this credential.`
        ),
    raw: sanitizeRaw(json, status),
  };
}

/** Keep only non-sensitive fields for the on-stage verification log. */
export function sanitizeRaw(json: Record<string, unknown>, status: number): unknown {
  const results = Array.isArray(json.results)
    ? (json.results as Array<Record<string, unknown>>).map((r) => ({
        identifier: r.identifier,
        success: r.success,
        code: r.code,
        detail: r.detail,
      }))
    : undefined;
  return {
    http_status: status,
    success: json.success ?? false,
    action: json.action,
    nullifier: json.nullifier,
    code: json.code,
    detail: json.detail,
    results,
  };
}

// ---------------------------------------------------------------------------
// Session tokens — HMAC-signed proof that the SERVER did the verification
// ---------------------------------------------------------------------------

const TOKEN_TTL_MS = 10 * 60 * 1000;

export interface TokenClaims {
  kind: VerifyKind;
  /** Tier this proof grants: Selfie → T2 (Builder), Orb/AgentKit → T3 (Signer). */
  tier: "T2" | "T3";
  nullifierHash: string;
  sybilScore: number;
  verifiedAt: number;
  exp: number;
  dev: boolean;
  /**
   * The session this proof was verified for. Without it, one verification is a
   * skeleton key: a token minted for room A would seat its holder in every other
   * room for the whole TTL. The DO rejects a token issued for a different room.
   */
  session: string;
}

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unb64url(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(env: WorldEnv): Promise<CryptoKey> {
  const secret = env.SESSION_KEY;
  if (!secret) throw new Error("SESSION_KEY not set — cannot sign verification tokens");
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/** Mint a signed token from a successful verification, bound to one session. */
export async function issueToken(
  env: WorldEnv,
  kind: VerifyKind,
  outcome: VerifyOutcome,
  session: string
): Promise<string> {
  if (!outcome.ok || !outcome.nullifierHash) throw new Error("cannot issue token for a failed verification");
  const claims: TokenClaims = {
    kind,
    tier: kind === "agentkit" ? "T3" : "T2",
    nullifierHash: outcome.nullifierHash,
    sybilScore: outcome.sybilScore,
    verifiedAt: outcome.verifiedAt,
    exp: outcome.verifiedAt + TOKEN_TTL_MS,
    dev: outcome.dev,
    session,
  };
  const key = await hmacKey(env);
  const payload = new TextEncoder().encode(JSON.stringify(claims));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, payload));
  return `${b64url(payload)}.${b64url(sig)}`;
}

/** Verify + decode a token. Returns null on tamper, bad signature, or expiry. */
export async function verifyToken(env: WorldEnv, token: string | undefined): Promise<TokenClaims | null> {
  if (!token) return null;
  const [p, s] = token.split(".");
  if (!p || !s) return null;
  let payload: Uint8Array;
  let sig: Uint8Array;
  try {
    payload = unb64url(p);
    sig = unb64url(s);
  } catch {
    return null;
  }
  const key = await hmacKey(env);
  const ok = await crypto.subtle.verify("HMAC", key, sig, payload);
  if (!ok) return null;
  let claims: TokenClaims;
  try {
    claims = JSON.parse(new TextDecoder().decode(payload)) as TokenClaims;
  } catch {
    return null;
  }
  if (typeof claims.exp !== "number" || claims.exp < Date.now()) return null;
  return claims;
}
