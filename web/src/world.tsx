/**
 * Client half of World verification.
 *
 * The browser never decides who is verified. It runs IDKit to obtain a proof,
 * hands that proof to our server (/api/verify/*), and receives back an
 * HMAC-signed token that the session Durable Object will trust. The tier a token
 * grants is the SERVER's decision, from a SERVER-side check against World.
 *
 * When no World app is configured, the server exposes a DEV fallback so the crew
 * can rehearse the whole arc; those proofs are explicitly marked `dev` and are
 * NEVER verified against World. The UI says so plainly.
 */

import { useCallback, useRef, useState } from "react";
import {
  IDKitRequestWidget,
  orbLegacy,
  selfieCheckLegacy,
  type IDKitResult,
  type Preset,
  type RpContext,
} from "@worldcoin/idkit";

export type VerifyKind = "selfie" | "agentkit";

/**
 * One attempt's configuration. Exposed in the UI so a failing combination can
 * be isolated by clicking, instead of by editing config and redeploying —
 * which is far too slow when the error is an opaque 403.
 */
export interface VerifyOptions {
  /** Override the server's WORLD_ENV for this attempt. */
  environment?: "production" | "staging";
  /** Force the Builder-tier credential (Selfie Check is partner-gated). */
  preset?: "orb" | "selfie";
  /** Skip World entirely. Marked dev, never verified, banner shown. */
  dev?: boolean;
  /**
   * Who is verifying — dev bypass only. The dev nullifier is derived from this
   * so a rehearsal behaves like the real thing: one person stays one unique
   * human across their attempts, and two people are two.
   */
  subject?: string;
}

export interface VerifyResult {
  token: string;
  sybilScore?: number;
  dev: boolean;
}

interface Deferred {
  kind: VerifyKind;
  resolve: (r: VerifyResult) => void;
  reject: (e: Error) => void;
}

interface WidgetConfig {
  app_id: `app_${string}`;
  action: string;
  rp_context: RpContext;
  preset: Preset;
  /**
   * IDKit defaults `environment` to "production". Not forwarding the server's
   * value meant the browser produced production proofs while the server signed
   * and verified as staging — which surfaced as an opaque 403 from our verify
   * endpoint, and as "Production request detected" in the simulator. Client and
   * server must always read this from the same place.
   */
  environment: "production" | "staging" | "sandbox";
  /** Server-side override so the Builder tier can fall back to Orb. */
  selfiePreset?: "orb" | "selfie";
}

const qs = (sessionId: string) => `session=${encodeURIComponent(sessionId)}`;

async function postProof(
  sessionId: string,
  kind: VerifyKind,
  proof: unknown,
  env?: string
) {
  const res = await fetch(`/api/verify/${kind}?${qs(sessionId)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    // Send the environment the proof was produced with, so the server verifies
    // against the same one. A mismatch here is what produced the opaque 403.
    body: JSON.stringify({ proof, env }),
  });
  const j = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    token?: string;
    sybilScore?: number;
    dev?: boolean;
    error?: string;
  };
  if (!res.ok || !j.ok || !j.token) throw new Error(j.error ?? "verification failed");
  return { token: j.token, sybilScore: j.sybilScore, dev: !!j.dev };
}

/**
 * Returns `verify(kind)` — a promise that resolves with a server-issued token —
 * and `widget`, the IDKit element the caller must render once.
 */
export function useWorldVerify(sessionId: string) {
  const [cfg, setCfg] = useState<WidgetConfig | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef<Deferred | null>(null);
  const lastOpts = useRef<VerifyOptions>({});

  const verify = useCallback(
    async (kind: VerifyKind, opts: VerifyOptions = {}): Promise<VerifyResult> => {
      setBusy(true);
      try {
        const params = new URLSearchParams({ kind, session: sessionId });
        if (opts.environment) params.set("env", opts.environment);
        if (opts.preset) params.set("preset", opts.preset);
        const ctx = (await (await fetch(`/api/verify/context?${params}`)).json()) as
          | {
              configured: true;
              app_id: string;
              action: string;
              environment?: "production" | "staging" | "sandbox";
              rp_context: RpContext;
              selfiePreset?: "orb" | "selfie";
            }
          | { configured: false; dev?: boolean; error?: string };

        // DEV bypass: explicitly requested, or offered because no World app is
        // configured. Always marked `dev` so the UI can say so.
        if (opts.dev || (!ctx.configured && ctx.dev)) {
          const identifier = kind === "agentkit" ? "orb" : "selfie";
          // A random nullifier per attempt made every dev seat a different
          // human, so one-human-one-seat could never fire and the cap table
          // could not show that the same person earned twice — in exactly the
          // run a judge watches. Deriving it from who is verifying keeps the
          // rehearsal honest: same person, same handle; different people,
          // different handles.
          const subject = (opts.subject ?? "").trim().toLowerCase() || "anonymous";
          const proof = {
            dev: true,
            protocol_version: "3.0",
            responses: [
              {
                identifier,
                proof: "dev",
                merkle_root: "dev",
                nullifier: `dev_${identifier}_${encodeURIComponent(subject)}`,
              },
            ],
          };
          const r = await postProof(sessionId, kind, proof, opts.environment);
          setBusy(false);
          return { ...r, dev: true };
        }

        if (!ctx.configured) {
          setBusy(false);
          throw new Error(ctx.error ?? "World not configured");
        }

        // Real IDKit flow — resolve when the widget's onSuccess fires.
        return await new Promise<VerifyResult>((resolve, reject) => {
          pending.current = { kind, resolve, reject };
          lastOpts.current = opts;
          setCfg({
            app_id: ctx.app_id as `app_${string}`,
            action: ctx.action,
            environment: opts.environment ?? ctx.environment ?? "production",
            rp_context: ctx.rp_context,
            /**
             * Selfie Check is partner-gated and is not guaranteed to exist in
             * the World simulator, which is the only way to test when the
             * TestFlight beta is full. `selfiePreset: "orb"` in the context
             * response falls the Builder tier back to Orb so the whole arc
             * stays testable — still a real, server-verified proof, just a
             * different credential. Defaults to Selfie Check.
             */
            preset:
              kind === "agentkit" || ctx.selfiePreset === "orb"
                ? orbLegacy()
                : selfieCheckLegacy(),
          });
          setOpen(true);
        });
      } catch (e) {
        setBusy(false);
        throw e instanceof Error ? e : new Error(String(e));
      }
    },
    [sessionId]
  );

  const onSuccess = useCallback(
    async (result: IDKitResult) => {
      const cur = pending.current;
      pending.current = null;
      setOpen(false);
      if (!cur) return;
      try {
        const r = await postProof(sessionId, cur.kind, result, lastOpts.current.environment);
        cur.resolve(r);
      } catch (e) {
        cur.reject(e instanceof Error ? e : new Error(String(e)));
      } finally {
        setBusy(false);
      }
    },
    [sessionId]
  );

  const onError = useCallback((err?: unknown) => {
    const cur = pending.current;
    pending.current = null;
    setOpen(false);
    setBusy(false);
    cur?.reject(new Error(typeof err === "string" ? err : "verification cancelled"));
  }, []);

  const widget = cfg ? (
    <IDKitRequestWidget
      open={open}
      onOpenChange={setOpen}
      app_id={cfg.app_id}
      action={cfg.action}
      rp_context={cfg.rp_context}
      environment={cfg.environment}
      allow_legacy_proofs
      preset={cfg.preset}
      onSuccess={onSuccess}
      onError={onError}
    />
  ) : null;

  return { verify, widget, busy };
}
