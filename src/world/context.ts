/**
 * rp_context signing (MASS-specs A4).
 *
 * IDKit's protocol-level requests require an `rp_context` that is generated and
 * signed by the RP's backend — never the browser. We sign it here with the RP
 * private key so the World App will accept the proof request, and so the request
 * (nonce, expiry, action) is authenticated to our app.
 *
 * The client fetches this before opening the widget; see web/src/world.ts.
 */

import { signRequest } from "@worldcoin/idkit-server";
import { actionFor, worldConfigured, type VerifyKind, type WorldEnv } from "./verify.js";

/** The RpContext shape IDKit expects on the client. */
export interface RpContext {
  rp_id: string;
  nonce: string;
  created_at: number;
  expires_at: number;
  signature: string;
}

export type ContextResponse =
  | {
      configured: true;
      app_id: string;
      action: string;
      environment: string;
      rp_context: RpContext;
      /** Builder-tier credential override — see WORLD_SELFIE_PRESET. */
      selfiePreset: "orb" | "selfie";
      /** Credential to request for THIS kind. */
      preset: "orb" | "selfie";
    }
  | { configured: false; dev: true }
  | { configured: false; dev: false; error: string };

/**
 * Build a signed rp_context for a given proof kind.
 * - Real app + RP key  → signed context the World App will honor.
 * - No app, DEV enabled → { dev:true }; the client uses the marked dev path.
 * - No app / no key     → an explicit error the UI can show.
 */
export function buildContext(
  env: WorldEnv,
  kind: VerifyKind,
  overrides: { environment?: string; preset?: string } = {}
): ContextResponse {
  if (!worldConfigured(env)) {
    if (env.WORLD_DEV_FALLBACK === "1") return { configured: false, dev: true };
    return {
      configured: false,
      dev: false,
      error: "World not configured (set WORLD_APP_ID and WORLD_RP_ID)",
    };
  }

  if (!env.WORLD_RP_PRIVATE_KEY) {
    return {
      configured: false,
      dev: false,
      error: "WORLD_RP_PRIVATE_KEY not set — cannot sign rp_context",
    };
  }

  // WORLD_SELFIE_PRESET=orb makes the Builder tier use Orb instead of the
  // partner-gated Selfie Check — needed when only the simulator is available.
  /**
   * Which credential proves each tier.
   *
   * The token's KIND comes from the endpoint that issued it, not from the
   * credential behind it — so the Signer step can be proven with a Selfie Check
   * and still be a distinct verification against the mass-agentkit action.
   * That matters at a venue with no Orb: WORLD_SIGNER_CREDENTIAL=selfie keeps
   * the Observer -> Builder -> Signer ladder and the two-distinct-humans
   * co-sign rule intact, without Orb hardware.
   */
  const defaultPreset =
    kind === "agentkit"
      ? env.WORLD_SIGNER_CREDENTIAL === "selfie"
        ? "selfie"
        : "orb"
      : env.WORLD_SELFIE_PRESET === "orb"
        ? "orb"
        : "selfie";
  const preset = (overrides.preset as "orb" | "selfie" | undefined) ?? defaultPreset;
  const selfiePreset = preset;

  const action = actionFor(env, kind);
  const sig = signRequest({ signingKeyHex: env.WORLD_RP_PRIVATE_KEY, action });

  return {
    configured: true,
    selfiePreset,
    preset,
    app_id: env.WORLD_APP_ID!,
    action,
    environment: overrides.environment ?? env.WORLD_ENV ?? "production",
    rp_context: {
      rp_id: env.WORLD_RP_ID!,
      nonce: sig.nonce,
      created_at: sig.createdAt,
      expires_at: sig.expiresAt,
      signature: sig.sig,
    },
  };
}
