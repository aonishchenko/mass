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
  /** Server-side override so the Builder tier can fall back to Orb. */
  selfiePreset?: "orb" | "selfie";
}

const qs = (sessionId: string) => `session=${encodeURIComponent(sessionId)}`;

async function postProof(sessionId: string, kind: VerifyKind, proof: unknown) {
  const res = await fetch(`/api/verify/${kind}?${qs(sessionId)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ proof }),
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

  const verify = useCallback(
    async (kind: VerifyKind): Promise<VerifyResult> => {
      setBusy(true);
      try {
        const ctx = (await (await fetch(`/api/verify/context?kind=${kind}&${qs(sessionId)}`)).json()) as
          | {
              configured: true;
              app_id: string;
              action: string;
              rp_context: RpContext;
              selfiePreset?: "orb" | "selfie";
            }
          | { configured: false; dev?: boolean; error?: string };

        // DEV fallback: no World app. Proof is explicitly marked and unverified.
        if (!ctx.configured && ctx.dev) {
          const identifier = kind === "agentkit" ? "orb" : "selfie";
          const proof = {
            dev: true,
            protocol_version: "3.0",
            responses: [
              {
                identifier,
                proof: "dev",
                merkle_root: "dev",
                nullifier: `dev_${identifier}_${crypto.randomUUID()}`,
              },
            ],
          };
          const r = await postProof(sessionId, kind, proof);
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
          setCfg({
            app_id: ctx.app_id as `app_${string}`,
            action: ctx.action,
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
        const r = await postProof(sessionId, cur.kind, result);
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
      allow_legacy_proofs
      preset={cfg.preset}
      onSuccess={onSuccess}
      onError={onError}
    />
  ) : null;

  return { verify, widget, busy };
}
