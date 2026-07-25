# World integration — setup & operation

MASS verifies humans with World, **server-side**. This is the turnkey guide to
switch it from local DEV mode to a real, judged deployment. Everything is
env-driven — no credentials are hard-coded.

Related: [`world-testing.md`](./world-testing.md) (the 25% feedback deliverable),
`src/world/verify.ts` (the server-side gate), `web/src/world.tsx` (the client).

---

## 0. How it works (30 seconds)

1. The browser fetches a backend-signed `rp_context` (`GET /api/verify/context`),
   runs IDKit (Selfie Check → Builder, Orb → Signer), and gets a proof.
2. The proof is POSTed to **our server** (`/api/verify/selfie|agentkit`), which
   verifies it against World's cloud API and, only on success, mints an
   **HMAC-signed token**.
3. The client presents that token when claiming a seat / delegating. The Durable
   Object trusts the token, never a client-asserted "verified".
4. Every verification is recorded (sanitized) and viewable at
   `GET /api/verify/log` — the booth-showable proof that checks happen server-side.

Tiers: **Observer (T1)** = verified but sybil score below threshold ·
**Builder (T2)** = Selfie Check · **Signer (T3)** = Orb via AgentKit delegation.
COMMIT actions need **2 present signers**; authority recomputes live.

---

## 1. Create the World app (Developer Portal)

1. At the World Developer Portal, create an app. Note its **`app_id`**
   (`app_...`) and **`rp_id`** (`rp_...`).
2. Generate/register the app's **RP signing key** (ECDSA). Keep the hex private
   key — it signs `rp_context`. This is a **secret**.
3. Create two **actions** (ids must match your env):
   - `mass-selfie` — the Builder / Selfie Check action.
   - `mass-agentkit` — the Signer / Orb delegation action.
4. **Selfie Check is partner-gated** (Beta). Request access for the Selfie Check
   preset for your app; until granted, use Orb for both tiers or stay in DEV
   mode (below).

## 2. Configure

Non-secret values live in `wrangler.jsonc` `vars` (already scaffolded — fill the
blanks):

```jsonc
"WORLD_APP_ID": "app_xxx",
"WORLD_RP_ID": "rp_xxx",
"WORLD_ENV": "staging",          // production | staging | sandbox
"WORLD_ACTION_SELFIE": "mass-selfie",
"WORLD_ACTION_AGENTKIT": "mass-agentkit",
"WORLD_SYBIL_THRESHOLD": "0.5"
```

Secrets — locally in `.dev.vars` (see `.dev.vars.example`), in prod via
`wrangler secret put`:

```bash
wrangler secret put WORLD_RP_PRIVATE_KEY   # hex ECDSA RP signing key
wrangler secret put SESSION_KEY            # also signs verification tokens
```

`SESSION_KEY` must be set — it signs the short-lived verification tokens. If it
is missing, seat claims fail closed.

## 3. Run locally

```bash
cp .dev.vars.example .dev.vars   # fill values; keep WORLD_DEV_FALLBACK=1 to rehearse without World
npm install
npm run web:build && npm run dev
```

- **DEV mode** (no `WORLD_APP_ID`/`WORLD_RP_ID`, `WORLD_DEV_FALLBACK=1`): the full
  arc works without World; proofs are **not** verified and the UI shows a
  `DEV MODE` banner. For rehearsal only.
- **Real mode** (app_id + rp_id + RP key set): IDKit runs for real and proofs are
  verified against World. `WORLD_DEV_FALLBACK` is ignored once an app is
  configured.

## 4. Deploy

```bash
npm run deploy        # builds web, then wrangler deploy
```

The account is pinned in `wrangler.jsonc`. For a judged deployment, ensure
`WORLD_DEV_FALLBACK` is **unset** so nothing runs unverified.

## 5. Show the server-side check at the booth (15% technical score)

World judges verify that proofs are checked server-side, live. Two ways to show it:

- **The code:** `src/world/verify.ts` → `verifyWorldProof()` is the `fetch()` to
  World's cloud verify endpoint. Point at it.
- **The log:** open `https://<your-worker>/api/verify/log?session=<id>` — every
  verification, with `ok`, credential, and World's `results[]`, sanitized. A
  forged proof appears as `ok:false` (the endpoint returns 401).

Quick forgery check (should 401):

```bash
curl -si -X POST "https://<your-worker>/api/verify/selfie?session=demo" \
  -H 'content-type: application/json' \
  -d '{"proof":{"responses":[{"identifier":"selfie","proof":"0xdead","merkle_root":"0x0","nullifier":"0x0"}]}}' | head -n 1
# -> HTTP/2 401
```

## 6. Definition-of-done checklist

- [ ] `WORLD_APP_ID`, `WORLD_RP_ID`, actions set; `WORLD_RP_PRIVATE_KEY` +
      `SESSION_KEY` as secrets.
- [ ] Selfie Check partner access granted (or Orb used for both tiers).
- [ ] Two humans reach Builder on the deployed URL, verified server-side.
- [ ] A forged payload returns 401 (see §5).
- [ ] A low-strength credential lands as Observer (sybil below threshold).
- [ ] Co-sign disabled with one signer, enabled with two — live.
- [ ] A signer leaving drops commit authority on screen.
- [ ] `WORLD_DEV_FALLBACK` unset for judging.
- [ ] `docs/world-testing.md`: ≥10 dev entries (done) + ≥2 **venue** testers.
