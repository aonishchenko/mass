# Bug Hunt 1 — full-repo audit

A thorough pass over the MASS repository (backend Worker + Durable Object, 0G /
Hedera / World / ENS modules, the storage/Hedera sidecar, the React frontend,
tests, and CI). Each item gives **where** (file:line), **why it matters**, and
**how to fix it**. Findings are grouped by severity; a prioritized fix order is
at the end.

Audited at commit `de14b65`. Legend: 🔴 critical · 🟠 correctness/integrity ·
🟡 UX/polish · ⚪ nice-to-have.

---

## A. Bugs

### A1. 🔴 The canonical-run attestation is FABRICATED, not fetched
**Where:** `src/zg/inference.ts:153`
```ts
return { text, sealed, attestationRef: sealed ? `att_${crypto.randomUUID()}` : undefined };
```
**Why it matters:** When a canonical run is "sealed", the code invents a random
`att_<uuid>` and stores it in `canonical.completed`. The UI shows this as a proof
chip. This directly violates the project's own honesty rule (`MASS-specs` A3:
"TEE attestation of sealed execution, never fabricated") **and** the 0G track's
hard requirement ("proof of 0G Compute — a real, fetchable TEE attestation"). A
judge who clicks the chip gets a made-up id. This is the single most damaging
correctness/credibility bug in the repo.
**Fix:** Fetch the real attestation from the 0G Compute provider after the run
(a `getAttestation(responseId)` call against the router / broker), and store that
reference. If no real attestation is available, set `attestationRef: undefined`
and force the honesty banner — never synthesize one. Until the real endpoint is
wired, at minimum rename to make the placeholder obvious and keep it out of any
"proof" UI.

### A2. 🔴 The Birth never mints the cap-table token or runs a payout — the entire Hedera "money" story is unwired
**Where:** `src/session-do.ts:909-947` (`closeSession`) only does `writeArchive` +
`session.closed`. The functions to mint/pay exist but have **no runtime caller**:
`createCapTableToken`, `mintCapTable`, `payoutSplit`, `createAccount`,
`announceIdentity` (`src/hedera/client.ts:110-140`) and their sidecar
implementations (`services/zg-storage/hedera.mjs`), plus `splitPayment`
(`src/hedera/split.ts`, tested but never called at runtime).
**Why it matters:** "The Birth → cap-table mint → The First Job → payout split"
is the demo's closing beat and the Hedera track's strongest evidence (Agentic
Payments $3k + Tokenization $1.5k). None of it executes. The events
`captable.minted`, `job.settled`, and `payout` are in the anchor set
(`client.ts:52-61`) but are never emitted. `HEDERA_CAPTABLE_TOKEN_ID` is read but
nothing ever creates the token.
**Fix:** In `closeSession`, after `session.closed`: (1) create Hedera accounts for
seats that lack one (or collect provided ones), (2) `mintCapTable` with the
cap-table allocation, emit `captable.minted`. Add a `receiveJobPayment` intent /
route that calls `splitPayment` (already correct + tested) → `payoutSplit` → emit
`payout`. Wire `announceIdentity` (HCS-14) at the Birth. See `HEDERA-TASK.md`
Reqs 3–6 — the doc already specifies this; it just isn't built.

### A3. 🔴 World verification tokens are not bound to a session — cross-session replay
**Where:** `src/world/verify.ts` (`TokenClaims` has no `session` field; `issueToken`
/`verifyToken`), consumed in `src/session-do.ts:396` (`claimSeat`) and `:452`
(`delegate`).
**Why it matters:** The HMAC token is signed with the global `SESSION_KEY` and
carries no session id. A token minted via `/api/verify/selfie?session=A` is
accepted by the DO for session **B** within its 10-minute TTL. A single
verification can seat the holder in many rooms; the "one verified human, one
seat" guarantee the cap table rests on is not enforced across sessions.
**Fix:** Include `session` in `TokenClaims`; have `/api/verify/*` stamp the
request's `?session=` into the token, and have `claimSeat`/`delegate` reject a
token whose `session` ≠ this DO's `sessionId`. (Also bind the IDKit `signal` to
the session for defense in depth — noted in `world-testing.md`.)

### A4. 🟠 One verified human can claim unlimited seats in the same session
**Where:** `src/session-do.ts:391-443` (`claimSeat`) — the World `nullifierHash`
is recorded on the seat but never checked for uniqueness.
**Why it matters:** The same person (same nullifier) can claim 5 seats and earn 5×
the cap-table share, which is exactly the sybil outcome World verification is
supposed to prevent. Nullifier uniqueness is the whole point of the anti-sybil
claim.
**Fix:** Before granting a seat, reject if the `nullifierHash` already belongs to
a present/claimed seat in this session (scan `session.seats`). Optionally allow
re-attaching to the existing seat instead (like `resumeSeat`).

### A5. 🟠 The Hedera panel's "N events awaiting consensus" is almost always wrong
**Where:** `web/src/Hedera.tsx:69`
```ts
const pending = Math.max(0, eventCount - (stats?.hcsMessages ?? 0));
```
**Why it matters:** `eventCount` is **all** session events; `hcsMessages` counts
only the anchored subset (`ANCHORED` in `client.ts:52` — ~8 of ~25 event types).
So `pending` is permanently large and grows forever (every `instruct`,
`draft.*`, `perm.recomputed`, `hcs.anchored`, etc. counts as "pending" but will
never be anchored). It reads as a broken/backlogged pipeline.
**Fix:** Compare against the count of **anchorable** events only. Either expose a
server-side count of anchored-eligible events, or compute
`localAnchorable = events.filter(e => shouldAnchor(e.type)).length` client-side
(export the `ANCHORED` set / a helper to the client) and use
`pending = max(0, localAnchorable - hcsMessages)`.

### A6. 🟠 The public CV page always shows the "default" session's agent
**Where:** `web/src/Cv.tsx:31` fetches `/api/ens/cv?name=${name}` with **no**
`session` param; `src/index.ts:82` then defaults the session to `"default"`, so
`/api/ens/cv` in the DO (`session-do.ts:180`) assembles the profile from whichever
session happens to be `"default"`.
**Why it matters:** `/cv/alice-crew.eth` (or any agent built in a non-default
room) renders the wrong record — the default room's cap table, brain root, etc.
Fine for the single-room demo, wrong for anything else, and the CV is the page
ENS judges read.
**Fix:** Maintain a name→session mapping (persist it when the agent name is
assigned, or encode the session in the CV URL, e.g. `/cv/<name>?session=<id>` and
have `Cv.tsx` forward it). Then resolve the profile from the correct DO.

### A7. 🟠 Contribution screening is mocked, not sealed 0G inference
**Where:** `src/session-do.ts:663` and `:830` call `mockScreen`
(`src/world/mock.ts:35`), which only flags text shorter than 3 chars.
**Why it matters:** The "brain immune system" (a sealed 0G screen of each
proposed contribution, `contrib.screened` with an attestation) is a 0G-track
feature (`ZG-TASK.md` Req 4) and part of the demo. Today any non-trivial
malicious contribution passes, and the `attestationRef` on `contrib.screened` is
a mock string.
**Fix:** Implement `screenContribution(env, chunk)` on the sealed lane (reuse the
canonical `runInference` path with a screening prompt), return a real verdict +
attestation, and call it in `propose`/`keepCandidate` instead of `mockScreen`.

### A8. 🟡 The x402 memo hash isn't the hash of the actual model request
**Where:** `src/session-do.ts:608` / `:617-634` (`payForCanonicalRun`) hashes
`messages.map(m => m.content).join("\n")` — i.e. just the user text. The real
request sent to the model (`runInference`, `inference.ts:109`) additionally
includes the citation **system prompt** built from the brain.
**Why it matters:** The x402 correlation claim is "take a `payloadHash` off HCS
and find the payment that settled that request." The memo hash doesn't correspond
to the request actually executed, so the correlation is loose.
**Fix:** Compute the request hash over the exact payload sent to the router
(model + full message array), or have `runInference` return the request hash it
used and pass that to `payForCanonicalRun`.

### A9. 🟡 `topicMessageCount` conflates "sequence number" with "message count"
**Where:** `src/hedera/mirror.ts:81-87` returns the newest `sequence_number` as
the total.
**Why it matters:** Correct only if the topic is single-use and 1-indexed with no
gaps. If the topic is reused across runs (or shared), the stat over-counts. It
feeds `/api/stats` and the panel.
**Fix:** Either accept the documented assumption explicitly, or page the messages
and count, or track the count server-side.

### A10. 🟡 Claiming a second seat on one socket orphans the first
**Where:** `src/session-do.ts:437` — `claimSeat` overwrites the socket's seat
attachment without checking whether the socket already holds a seat.
**Why it matters:** A client that sends `claimSeat` twice creates two seats but
only the second is reachable from that socket; the first lingers in the crew list
and cap-table space. Minor, but it muddies the crew.
**Fix:** If `meta.seat` is already set, reject the claim (or treat as a no-op /
resume).

---

## B. Missing features & unwired code (by track)

### World (mostly built ✅ — gaps)
- **Continuity is soft** — `verify.continuity.ok` stamps a timestamp but never
  requires a fresh Selfie proof at cosign time (`session-do.ts:702-706`). Req 4
  is "record", not "enforce". Add an optional fresh-token requirement.
- **Session-bound tokens + nullifier uniqueness** — see A3/A4.
- **Identity Check (B3.1)** and **ERC-8004 registration (B3.2)** — not built
  (stretch tracks; fine to defer).

### ENS (dev-complete ✅ — real path not wired)
- **No real subname minting.** Names are *derived* (`joinName`), never registered
  on an L2 registry. `ENS_DURIN_REGISTRY` is read nowhere except as an env
  placeholder. Build a Durin `register()` writer (sidecar, like Hedera) so seats
  get real, resolvable subnames.
- **Agent profile is assembled but never written to ENS.** `agentTextRecords`
  (`ens.ts`) produces the record set; nothing writes it to a resolver. Add
  `writeAgentProfile` (sets text records + primary name) at the Birth.
- **CV session binding** — see A6.
- **Forward/reverse consistency (Req 6)** exists only inside `resolveName`; there
  is no ERC-8004 cross-check yet.

### Hedera (sidecar built, Worker unwired)
- **The Birth mint + First Job payout are not called** — see A2 (the biggest
  Hedera gap; the code exists, it just isn't invoked).
- **Schedule Service is entirely absent.** No `scheduleExpiry`; `HEDERA-TASK.md`
  Req 6 (a scheduled transaction on HashScan) is unbuilt. There's a dedicated
  Hedera track for the Schedule Service.
- **HCS-14 announcement** — `announceIdentity` exists, never called.

### 0G (compute + storage built, identity absent)
- **Real TEE attestation** — see A1.
- **Agentic ID (ERC-7857) mint + crew delegation** — not implemented anywhere
  (no `mintAgenticId`/`delegateUser`). This is a **required deliverable** for the
  0G "Best AI Product" track ("Agentic ID deployment link"). Highest-value 0G gap.
- **Sealed immune-system screening** — see A7.

### Core product
- **The Build Path UI does not exist.** `BUILD-PATH.json` and the twelve-slot
  readiness model (`BUILD-PATH.md`, `STEP-BY-STEP-AGENT-WORKFLOW.md`) are
  documented but no code reads the JSON or renders the `Agent readiness — N/12`
  sidebar. This is a headline product concept in the pitch.
- **The "agent is a git repository" model is not literally implemented.**
  Contributions are event-log chunks, not files in `KNOWLEDGE/`, `SKILLS/`,
  `SOUL.md`, etc. `AGENT.md`/`CONTRIBUTING.md` describe a repo structure the code
  doesn't produce. Either build the file-materialization step or soften the
  git-native claims to match the event-sourced reality.
- **Marketplace listing (Virtuals ACP)** — `LISTING-ON-VIRTUALS-ACP.md` /
  `MARKETPLACE-EARNINGS.md` describe it; no code implements the ACP endpoint or
  the earnings sweep.

---

## C. Testing & CI gaps

- **No CI runs typecheck / tests / build.** The only workflow
  (`.github/workflows/zg-storage-image.yml`) builds and deploys the sidecar image
  on every push. Nothing runs `npm run typecheck`, `npm test`, `npm run web:build`,
  or `node scripts/grep-hex.mjs`, so a type error or failing test can land on
  `main` (and this is a shared, fast-moving branch). **Fix:** add a `ci.yml` that
  runs those four on PRs/pushes. Highest-leverage process fix.
- **No tests for the Durable Object** (`session-do.ts`) — the most complex,
  concurrency-sensitive file (seq assignment, quorum, harvest, close). Add
  `@cloudflare/vitest-pool-workers` DO tests: claim→verify→cosign→accept→close,
  and the leave-drops-quorum path.
- **No tests for** `world/context.ts` (rp_context signing), `ens.resolveName`
  real path, `hedera/client.ts`, or `inference.ts` SSE parsing.
- **`split.ts` is well tested but dead at runtime** — wiring it (A2) is what makes
  those tests meaningful.

---

## D. Smaller issues / polish

- 🟡 **Import after a statement.** `web/src/Rail.tsx:31`
  `import { HederaPanel } from "./Hedera";` sits *after* the `TIER` const (line
  25). Valid (imports hoist) but unconventional and lint-flaggable — move it up
  with the other imports.
- ⚪ **`assembleAgentProfile` re-folds the cap table** (`ens.ts`) instead of
  reusing `capTable()` (`reduce.ts:245`). Two implementations can drift; call the
  shared one.
- ⚪ **`SESSION_KEY` is required for seat claims but blank by default** in
  `.dev.vars.example`. `verifyToken` throws (not returns null) when it's unset, so
  a dev who skips it gets an opaque "intent failed" on claim. Emphasize it in the
  setup guide, or fail fast with a clear message.
- ⚪ **`hcs.anchored` events inflate the log** (emitted per anchored event) and
  worsen A5's miscount; harmless otherwise.
- ⚪ **`recentTurns` feeds canonical answers into draft context** — arguably fine,
  but it lets an unattested draft see prior sealed output; confirm that's intended.

---

## E. Suggested fix order (highest leverage first)

1. **A1** — stop fabricating the attestation (honesty + 0G track). Small change,
   big credibility.
2. **C (CI)** — add typecheck/test/build/grep-hex CI so nothing else regresses.
3. **A2 + Hedera First Job** — wire the Birth mint + payout (code already exists
   and is tested; this unlocks two Hedera tracks and the demo's finale).
4. **0G Agentic ID mint + delegation** — required deliverable, currently absent.
5. **A3 + A4** — session-bind tokens and enforce one-seat-per-human (integrity of
   the entire cap-table claim).
6. **A6** — fix CV session binding (the page ENS judges read).
7. **A7** — real sealed screening (replace `mockScreen`).
8. **Build Path UI** — render the twelve-slot readiness from `BUILD-PATH.json`.
9. **A5, A8–A10, Section D** — correctness/polish.
10. **ENS real Durin minting + write-to-chain**, **Hedera Schedule Service**,
    **marketplace listing** — remaining "real path" wiring.

---

*Method: read every source file (Worker entry, Durable Object, core reducer/perms,
World/ENS/Hedera/0G modules, the sidecar, all React components, tests, CI) and
cross-checked callers with grep. Bugs cite exact locations; "missing" items were
verified absent by searching for any runtime caller.*
