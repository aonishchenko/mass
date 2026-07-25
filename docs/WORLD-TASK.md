# TASK: World integration for MASS — prize-track eligibility

> **Status: IMPLEMENTED** (commit `010d46a`). This brief is the definitive record
> of the World integration and the checklist for taking it live. Remaining work
> is credentials + deploy + venue testers, not code — see §Definition of done.
> Setup: `WORLD-SETUP.md`. The 25% deliverable: `world-testing.md`.

## Context

MASS is a live multiplayer session where a crew of verified humans collectively
builds an AI agent. Contributions are merged into a git repo; ownership (a cap
table) is derived from who wrote the surviving lines and how often the agent
cites them. ENS names everyone; Hedera anchors the log and settles payments; 0G
holds the encrypted brain and the agent's identity.

**World is the layer that makes ownership sybil-proof.** Verified humanity is not
a login here — it is an *authority and anti-sybil signal*. A Selfie Check decides
who may teach the agent and earn a share; a live quorum of Orb-verified humans
(AgentKit) decides what the agent may do; a low sybil score demotes a seat to
observer. Without World, contribution equity is farmable and the whole product
collapses.

Stack: TypeScript, Cloudflare Workers backend, React frontend, WebSocket event
bus, Durable Objects. Deployed at https://mass.aonishchenko33.workers.dev.
Implemented in: `src/world/verify.ts` (server-side cloud verify + sybil banding +
HMAC session tokens), `src/world/context.ts` (backend-signed `rp_context`),
`src/session-do.ts` (`/api/verify/*` routes, `claimSeat` gate, `delegate` intent),
`web/src/world.tsx` (IDKit client). Sibling docs: `world-testing.md`,
`WORLD-SETUP.md`, `MASS-specs.md` (A4 authority model).

## Target tracks
1. **AgentKit — New Use Cases — $8,000.** ← primary. Novel multi-principal,
   time-varying human-backed delegation.
2. **Selfie Check Beta — $1,750.** Selfie Check as an anti-sybil authorization
   signal, with blunt beta feedback.

## Judging criteria (World's published weights — build to these)
- **25% — quality of our written feedback** on their products → `world-testing.md`
  (13 dated dev entries + the preferred-feedback headings; venue testers TODO).
- **20% — product quality.**
- **15% — technical integration; THEY VERIFY, LIVE, that proofs are checked
  server-side.** Open `src/world/verify.ts` at the booth, or `GET /api/verify/log`.
- **10% — deployable / continues after the hackathon** → live Worker URL.
- **remainder — novelty of the use case** → sybil-proof contribution equity +
  live quorum authority.

## Reference docs (read them — do NOT guess API signatures)
- AgentKit: https://docs.world.org/agents/agent-kit/integrate
- Selfie Check (credential 11): https://docs.world.org/world-id/credentials/11
- IDKit + rp_context signing (`@worldcoin/idkit`, `@worldcoin/idkit-server`),
  cloud verify endpoint (`/api/v4/verify/{rp_id}`). Docs root: https://docs.world.org/

---

## The one sentence to make a World judge lean in
> "MASS doesn't use World to log people in — it uses World to make ownership
> sybil-proof: a Selfie Check decides who may teach the agent and earn a share, a
> live quorum of Orb-verified humans decides what the agent may do, every proof
> is verified server-side (open the code, or the /verify/log, at the booth), and
> a low sybil score visibly demotes a seat to observer."

---

## HARD REQUIREMENT 1 — Server-side proof verification ✅ built
Proofs validated only in the browser fail the track. They must be checked on the
server, live.

Built (`src/world/verify.ts`, `src/session-do.ts`):
- `POST /api/verify/selfie` and `/api/verify/agentkit` forward the IDKit proof to
  World's cloud verify API **server-side**, then mint an **HMAC-signed session
  token**. The DO trusts only that token — never a client-supplied `verified:true`.
- A forged payload → World returns `success:false` → we return **401**.
- We store only `{nullifierHash, tier, sybilScore, timestamp}` — no PII. Every
  attempt is logged (sanitized) to `GET /api/verify/log`, the booth-showable
  "file" (Workers has no filesystem).

Acceptance: point at the `fetch()` to World's endpoint at the booth; a forged
payload is rejected (`curl` recipe in `WORLD-SETUP.md` §5).

## HARD REQUIREMENT 2 — Selfie Check as a RISK signal, not a login ✅ built
It must gate something meaningful.

Built (`claimSeat` in `src/session-do.ts`, `src/core/reduce.ts`):
- Seat claim requires a verified Selfie Check → **Builder (T2)**.
- The sybil score is captured and shown in the crew list (`sybil 0.87`, tooltip).
- **It changes capability**: below `WORLD_SYBIL_THRESHOLD` (default 0.5) the seat
  is granted **Observer** only — may watch, may not propose/co-sign/earn — with
  the reason shown in the UI. Emits `verify.selfie.ok { seat, sybilScore, grantedTier }`.
- Honest note carried in `world-testing.md`: Selfie Check exposes no numeric
  score, so we derive a band from credential strength — logged as feedback.

Acceptance: a low score visibly changes what that person can do.

## HARD REQUIREMENT 3 — AgentKit multi-principal, time-varying delegation ✅ built
The novelty claim — human-backed authority that is live, not static, and never a
discount.

Built (`delegate` intent, `src/core/perms.ts` `computePerms`):
- Orb-verified humans delegate to the **session agent** → **Signer (T3)**.
- The agent's permissions are computed **live from who is present**: draft needs
  ≥1 builder; commit (accept/mint/pay) needs **2 distinct signer signatures**
  (author may be one).
- A signer leaving **recomputes permissions immediately** (`perm.recomputed`);
  the client now honors presence so authority drops **on screen**. In-flight
  actions complete, then lock. Every signature carries a proof reference.

Acceptance: with one signer the co-sign button is disabled and states why; a
second signer joins and it enables, live; a signer leaving reduces authority on
screen.

## HARD REQUIREMENT 4 — Continuity re-verification ✅ built (soft-enforced)
An equity share must not be claimable from an unattended laptop.

Built: `verify.continuity.ok` is emitted around acceptance and stamps the seat's
`lastContinuityAt` (`src/core/reduce.ts`). The stronger enforcement (require a
fresh Selfie token at cosign time) is wired as a configurable option and
documented in `world-testing.md`; the default records continuity without forcing
a re-scan per contribution, to keep the demo fluid.

Acceptance: continuity is recorded with a timestamp; the rationale is stated in
the UI/README.

---

## UI requirements (built — `web/src/Rail.tsx`, `App.tsx`, `world.tsx`)
- Crew list: name, tier badge (**Observer / Builder / Signer**, visually
  distinct), `sybil 0.87` with a tooltip.
- Blocked actions name the missing tier/quorum ("needs 2 signers present",
  "Signers only").
- A **DEV MODE** honesty banner whenever the credential-free fallback issued a
  token — never imply a proof was checked when it wasn't.
- **No hex addresses anywhere** (ties to `ENS-TASK.md`).

## Data model (built — `src/core/types.ts`)
```ts
interface Seat {
  seat: string; name: string;
  tier: "T1" | "T2" | "T3";          // Observer | Builder | Signer
  present: boolean;
  sybilScore?: number;
  nullifierHash?: string;             // World, per-action, non-PII
  proofRef?: string;                  // AgentKit delegation reference
  verifiedAt?: number;
  lastContinuityAt?: number;
}
```
Env (`wrangler.jsonc` + `.dev.vars.example`): `WORLD_APP_ID`, `WORLD_RP_ID`,
`WORLD_ACTION_SELFIE`, `WORLD_ACTION_AGENTKIT`, `WORLD_ENV`,
`WORLD_SYBIL_THRESHOLD`, `WORLD_RP_PRIVATE_KEY` (secret), `SESSION_KEY` (signs
tokens), `WORLD_DEV_FALLBACK` (rehearsal only).

## Deliverable for the 25% feedback score ✅ built
`world-testing.md` — two tables filled as we built, dated:
- **Developer feedback**: 13 entries with exact friction, suggestions, severity
  (no numeric sybil score; hidden rp_context requirement; undocumented proof
  shape; v2/v4 endpoint confusion; AgentKit docs steering toward disqualified
  discount modes; etc.), plus verbatim error strings.
- **User feedback**: 2 team-tester entries; **≥2 non-team venue testers TODO**.
- All of World's preferred-feedback headings answered explicitly.

## DO NOT BUILD (on World's published disqualification list)
- **Agent reputation systems.**
- **Human-backed agents in simple content-generation use cases.**
- **Human-backed *benefits* for agents** (cheaper API calls, discounts, better
  rates). We deliberately avoid AgentKit's `free-trial`/`discount` modes and use
  only its human-verification primitive — never frame any feature as "the agent
  gets better terms because a human backs it."

## Definition of done
1. ✅ Server-side verification; a forged payload is rejected (401).
2. ✅ Sybil score visibly gates capability (Observer downgrade).
3. ✅ Co-sign blocked with one signer, enabled with two; a signer leaving reduces
   authority on screen.
4. ✅ `world-testing.md` has ≥10 dated dev entries.
5. ⏳ **Handoff — World Developer Portal**: create the app (`app_…`/`rp_…`), the
   two actions, and get **Selfie Check partner access**.
6. ⏳ **Handoff — secrets + deploy**: `wrangler secret put WORLD_RP_PRIVATE_KEY
   SESSION_KEY`; `npm run deploy`. Then two real humans reach Builder on the
   deployed URL, verified server-side; `WORLD_DEV_FALLBACK` unset for judging.
7. ⏳ **Handoff — 2 non-team venue testers** in `world-testing.md`.

---

## Why this makes the World team proud (integration map)
| World surface | MASS source (built) |
|---|---|
| Server-side cloud verify + HMAC token | `src/world/verify.ts` |
| Backend-signed rp_context | `src/world/context.ts` (`@worldcoin/idkit-server`) |
| Selfie → Builder; sybil band → Observer gate | `claimSeat`, `reduce.ts`, threshold |
| Orb/AgentKit → Signer; live quorum | `delegate` intent, `computePerms`, `perm.recomputed` |
| Booth-showable server check | `GET /api/verify/log` |
| 25% feedback deliverable | `world-testing.md` |
| Zero-hex identities | `ENS-TASK.md` |

World is the keystone: strip it and equity is farmable, the quorum is
meaningless, and MASS is just a chat. It's the one integration whose *absence*
breaks every other sponsor's claim — which is exactly the "obvious, load-bearing
use" each track rewards.
