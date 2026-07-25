# MASS × World — Beta Testing Documentation

**Products tested: Selfie Check (Beta) and AgentKit, integrated into MASS
(Multiplayer Agent Session System), ETHGlobal Lisbon 2026.**

This is the required deliverable for the Selfie Check Beta and AgentKit tracks.
Feedback quality is 25% of the rubric, so this is written to be *useful*, not
flattering: every entry is dated, concrete, and includes the exact friction and
a suggestion. Where a limitation shaped our design, we say so.

> Status of testers: the developer log below is real, from our build (24–25 Jul).
> The user log has our two team testers; **≥2 non-team testers at the venue are
> still required before submission** and are marked TODO. We will not present
> fabricated tester feedback.

---

## 1. How MASS uses each credential (context for reviewers)

- **Selfie Check** — used as an *authorization and anti-sybil signal, not a
  login*. It gates the **Builder** tier (T2): only a verified unique human may
  instruct the shared agent and proposecontributions. The credential's strength
  is recorded per seat as a **sybil score** and surfaced as a risk badge. Below a
  configurable threshold (default 0.5) the seat is granted **Observer** only —
  the human is verified, but not trusted to earn a cap-table share. Every proof
  is **verified server-side** (`POST /api/verify/selfie` → World cloud verify);
  rendering the widget is never sufficient.
- **AgentKit** — used for the **Signer** tier (T3): an Orb-verified human
  *delegates to the shared session agent*. Consequential actions (accepting a
  contribution, closing the session, minting) require a live quorum of two
  distinct signers. This is multi-principal, time-varying delegation — authority
  recomputes the instant a signer joins or leaves.
- We deliberately do **not** use AgentKit's `free-trial`/`discount` modes: giving
  a human-backed agent cheaper/better terms is on the track's disqualification
  list. We use only the human-verification primitive.

---

## 2. Developer feedback log (SDK/API friction, docs gaps, setup)

| # | Date/time (WEST) | Product | What we did | What happened | Friction / gap | Suggestion | Sev (1–5) |
|---|---|---|---|---|---|---|---|
| 1 | 24 Jul 21:40 | Selfie Check | Opened the credential-11 docs page for integration specs | Page lists validity/sybil-resistance but the SDK section is "coming-soon" — no config, no proof shape, no verify endpoint | Cannot integrate from the credential page alone | Add a minimal end-to-end Selfie Check example (request → proof → server verify) to the credential page | 4 |
| 2 | 24 Jul 22:05 | Selfie Check | Looked for a numeric uniqueness/sybil score in the verify response | There is none; the docs rate sybil resistance only as "Some" | We wanted to *gate on* score; without a number we had to derive a band from credential strength (orb=0.95 … device=0.40) | Return a numeric uniqueness/quality score (even coarse: 0–1) in the verify response so RPs can set real thresholds | 4 |
| 3 | 24 Jul 22:30 | World ID verify | Tried to pick the verify endpoint | Docs show `POST /api/v4/verify/{rp_id}` while long-standing guides use `/api/v2/verify/{app_id}`, plus an `app_not_migrated` error | Unclear which endpoint/version handles legacy (3.0) proofs from `selfieCheckLegacy` | State plainly, per credential, which verify endpoint+version to call and the exact legacy request body | 3 |
| 4 | 24 Jul 23:10 | IDKit | Wired the client request | `IDKitRequestConfig` *requires* a backend-signed `rp_context` (ECDSA sig over nonce/created_at/expires_at) | This hard requirement isn't on the credential page; found it only in `idkit-core` type defs | Document the rp_context signing flow prominently, with a Node/Worker `signRequest` snippet | 4 |
| 5 | 24 Jul 23:25 | idkit-server | Implemented rp_context signing | `signRequest({ signingKeyHex, action })` works and is pure, but the RP signing key + `rp_id` provisioning steps aren't described where an integrator starts | Provisioning path (where the RP key comes from, how rp_id maps to app_id) is scattered | One "RP setup" page: create app → get rp_id → generate/register RP signing key → sign context | 3 |
| 6 | 25 Jul 00:05 | Selfie Check | Tried to exercise `selfieCheckLegacy()` end to end | Preset is documented as "available to select partners" | Beta is partner-gated, so full live verification needs approval we don't yet have | Provide a sandbox/staging path for the Selfie Check preset so hackathon teams can test before partner approval | 3 |
| 7 | 25 Jul 00:20 | IDKit | Needed the `onSuccess` proof shape to build the verify request | Not enumerated on the docs site; read `ResponseItemV3`/`IDKitResultV3` from the shipped `.d.ts` | Proof payload shape undocumented outside the type defs | Publish the `IDKitResult` (V3/V4/session) shapes with a field-by-field table | 3 |
| 8 | 25 Jul 00:40 | IDKit React | Rendered `IDKitRequestWidget` | Required props (`app_id`, `action`, `rp_context`, `allow_legacy_proofs`, `preset`) only discoverable via types; the docs example omitted several | Copy-paste example is incomplete | Ship a complete, compiling React example for the widget | 3 |
| 9 | 25 Jul 01:15 | AgentKit | Read the integrate guide for human-backed delegation | The SDK is framed around x402 `free-trial`/`discount` modes — the exact pattern the track disqualifies | Docs steer you toward a disqualified use case; the primitive we needed (`createAgentBookVerifier` → anonymous `humanId`) is thin | Add a non-benefits example: "verify a human backs this agent, then authorize an action" without discounts | 4 |
| 10 | 25 Jul 01:35 | AgentKit | Traced how a delegation maps to an app role | Registration/verification is on World Chain (eip155:480) via AgentBook, but the hop from "human-backed" to "grant this session role" is left to the integrator | No reference flow for role/authority granting | Provide a reference "delegation → authority" flow, not just payment gating | 3 |
| 11 | 25 Jul 01:50 | idkit-server (npm) | `npm i @worldcoin/idkit-server` | ERESOLVE against our existing `ethers` pin; needed `--legacy-peer-deps` | Peer-dep friction in a mixed toolchain | Loosen peer ranges or document the workaround | 2 |
| 12 | 25 Jul 02:10 | World ID verify | Considered binding proofs to our session/seat | For legacy 3.0 proofs the `signal` → `signal_hash` recipe isn't documented; we defaulted signal to empty and rely on action + nullifier + a short-TTL HMAC token | Weaker context-binding than we'd like | Document signal handling for legacy proofs (how to compute `signal_hash`) | 2 |
| 13 | 25 Jul 02:25 | Environments | Matched proof `environment` to the verify endpoint | `environment: production\|staging\|sandbox` must line up with the app + endpoint, but the mapping isn't spelled out | Easy to mismatch and get opaque failures | A short table: portal app env ↔ IDKit `environment` ↔ verify host | 2 |

Target of ≥10 met (13 entries). Errors seen verbatim during integration:
`ERR_PACKAGE_PATH_NOT_EXPORTED` (probing idkit exports), `ERESOLVE could not
resolve` (idkit-server install), and the verify error codes we handle
(`app_not_migrated`, `all_verifications_failed`, `verification_error`).

---

## 3. User feedback log (UX friction, comprehension, camera/selfie flow)

| # | Date/time (WEST) | Tester (role) | Step | Observation | Suggestion |
|---|---|---|---|---|---|
| 1 | 25 Jul 03:00 | Team member A (builder) | Claim seat → Selfie Check | Understood *why* verification was asked ("so my share can't be faked"); the one-line explainer under the input carried it | Keep the "why" copy; it materially reduced hesitation |
| 2 | 25 Jul 03:10 | Team member B (builder→signer) | Builder, then "Become a Signer (Orb)" | The two-step tiering (Selfie → Builder, Orb → Signer) was clear once labelled; before labels it wasn't obvious a second step existed | Label the step-up explicitly (done) and show what it unlocks |
| 3 | — | **TODO: non-team tester #1 (venue)** | Selfie camera flow | *to fill at venue* | *to fill* |
| 4 | — | **TODO: non-team tester #2 (venue)** | Observer downgrade comprehension | *to fill at venue* | *to fill* |

**≥2 non-team testers are required before submission** (rows 3–4). Run them at
the booth with the deployed URL; note comprehension of *why* verification is
asked, camera/liveness friction, and whether the Observer downgrade reads as
fair.

---

## 4. World's preferred-feedback headings

- **Integration experience / time-to-integrate.** Server-side verification +
  tiering + live quorum: ~1 build session. The long pole was *discovering
  requirements* (rp_context signing, proof shape, verify endpoint version), not
  writing code — most answers came from reading `.d.ts`, not the docs site.
- **Ease of integration (docs vs SDK).** The SDK is solid: `signRequest` is
  clean and pure (Worker-friendly), and the legacy presets are ergonomic. The
  docs are the weak point: the Selfie Check page has no working example, the
  rp_context requirement is hidden, and the proof payload isn't published.
- **Value of Selfie Check.** High *as an authorization signal*: it let us gate
  the Builder tier and make equity sybil-resistant, which is the whole point of
  MASS. It let us **block/gate/step-up** meaningfully (Observer vs Builder vs
  Signer), not just log someone in.
- **Value of the sybil score.** Would be high — but it isn't exposed as a
  number. We *want* to threshold on it. Bands we'd use if given a 0–1 score:
  `<0.5` Observer, `0.5–0.85` Builder, `≥0.85` eligible to step up to Signer.
  Today we approximate this from credential strength; a real score would replace
  the approximation directly.
- **POH (Orb) vs Selfie-only cohorts.** By design we treat them differently:
  Selfie → Builder, Orb → Signer. Orb's stronger assurance is what we require
  before granting COMMIT authority. The distinction maps cleanly onto a
  two-tier trust model and we'd keep it.
- **Overall sentiment.** We'd keep using it and expand it. The primitive is
  exactly right for "provable, sybil-resistant contribution equity." Publish a
  numeric score and one complete Selfie Check example and the integration goes
  from "read the types" to "copy the example."

---

## 5. Identity Check — attribute necessity & data minimization

Not built for this submission (Identity Check is a separate stretch track). If
added, MASS would request a single boolean (e.g. over-18) to gate one
"regulated session" action, receive only "criteria met", store no age/name/
document data, log only an attestation hash, and scope it to the session.

---

## 6. Summary verdict (≤5 sentences)

World's verification is the right foundation for sybil-proof contribution equity,
and the SDK primitives (legacy presets, `signRequest`) are clean and
Worker-compatible. The integration was gated less by code than by
under-documentation: the rp_context signing requirement, the proof payload
shape, and the verify endpoint version all had to be reverse-engineered from
type definitions. The single highest-leverage improvement would be exposing a
numeric uniqueness/sybil score in the verify response — our product wants to
threshold on exactly that. Second: one complete, compiling Selfie Check example.
With those two changes this goes from a strong-but-spelunking integration to a
frictionless one.
