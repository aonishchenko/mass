# MASS — Shared Session Module
## Spec v1.0 — session core, lanes, contribution lifecycle
**Subordinate to [MASS-specs.md](./MASS-specs.md) v0.6. Where the two disagree, the master spec wins — except where this file is explicitly marked as extending a frozen contract (see §9).**

Covers the parts of master-spec modules **M0** (core), **M2** (inference router)
and **M6** (0G brain) that concern *how two or more humans share one agent
session*. Does not cover World / Hedera / ENS integration — those consume this
module through the [C4](./MASS-specs.md) worker interfaces and are mocked here.

---

# 1. Scope & why this is one deliverable

The master spec splits this work across three module cards. For build purposes
it is **one vertical slice: "Session Room v0"** — two browsers, one shared
agent, 0G only, everything else mocked.

Rationale: this slice stands alone as a demo if any other sponsor lane slips.
Master Part E labels MP1 the safety floor; this slice is the floor *beneath*
that one — it needs no sponsor integration at all to be demoable.

**In scope:** session state, WS protocol, authority evaluation, both inference
lanes, contribution lifecycle in both review modes (live acceptance + batch
harvest, mid-session and at close), brain writes to 0G Storage, session archive.
**Out of scope:** server-side World verification (M3), HCS logging (M4), ENS
naming (M5), minting and First Job (M7).

---

# 2. Architecture

## 2.1 The chain is not the transport

Real-time coordination is a WebSocket and an authoritative Node server. 0G
provides durability, inference and proof. The live session never round-trips
through a chain — latency would make co-steering unusable.

State this plainly to judges too. It is the honest framing and it pre-empts the
"why is this even on-chain" question.

```
Browser A ─┐                      ┌─ 0G Compute (Router / direct broker)
           ├─ WS ─ Session Server ┼─ 0G Storage  (encrypted brain + archive)
Browser B ─┘        (authority)   └─ 0G Chain    (Agentic ID mint — M6/M7)
                        │
                  mocks: world/ hedera/ ens/
```

## 2.2 File layout

```
src/core/     types.ts  session.ts  reduce.ts  perms.ts  bus.ts
src/zg/       inference.ts  storage.ts  crypto.ts  brain.ts  archive.ts
src/world/    mock.ts        ← real in M3
src/hedera/   mock.ts        ← real in M4
src/ens/      mock.ts        ← real in M5
src/ui/       cockpit — WS client + replay + contribution panel
```

---

# 3. The three-layer protocol

**Clients send Intents. The server emits Events. Clients render only from
Events.** No exceptions, no optimistic UI in v1.

```ts
// 1. client → server. a request, not a fact.
type Intent =
  | { kind: "claimSeat";     name: string }
  | { kind: "instruct";      text: string; lane: "draft" | "canonical" }
  | { kind: "proposeContrib"; text: string; source: ContribSource }
  | { kind: "challengeContrib"; contribId: string; reason: string }
  | { kind: "cosign";        contribId: string }
  | { kind: "openHarvest" }                       // any time — §7.5.1
  | { kind: "keepCandidate"; harvestId: string; candidateId: string; text: string }
  | { kind: "cosignBatch";   harvestId: string }  // 2-of-M over the whole batch
  | { kind: "cancelHarvest"; harvestId: string }
  | { kind: "closeSession" };                     // rejected if a harvest is open

// 2. server → all clients. two frame types, only one is durable.
type Frame =
  | { t: "event"; e: MassEvent }                  // durable, hashable, HCS-bound
  | { t: "delta"; runId: string; token: string }; // ephemeral, fan-out only
```

Server pipeline for every intent:

```ts
function handle(intent: Intent, seat: Seat, s: Session): MassEvent[] {
  const perms = computePerms(s.crew);       // pure — master spec M0
  if (!perms.allows(intent.kind, seat.tier)) throw new Denied();
  return reduce(s, intent);                 // single writer; appends to s.events
}
```

Clients never author events. This is what makes the HCS hand-off in M4 free:
`logEvent` subscribes to the same emit and needs no filtering.

---

# 4. Replay (event sourcing)

**State is never stored. State is derived by folding the log.**

```ts
const state = events.reduce(apply, EMPTY_SESSION);
```

`apply(state, event) → state` is the only way a session mutates.

## 4.1 What replay buys

| Situation | Mechanism |
|---|---|
| Second tab joins | ship event array, client folds, both tabs identical by construction |
| Wifi drops (it will) | reconnect, request events since seq N, fold, caught up |
| Server restarts | fold the log, session is back |
| Demo must run clean twice (P8) | same log in, same state out |
| Cap table | the master C1 derivation rule is itself a fold — a judge can fold the HCS topic themselves and get our exact numbers |

The last row is novelty claim #1 made literal rather than asserted.

## 4.2 Determinism rules (non-negotiable)

Banned inside `apply()`: `Date.now()`, `Math.random()`, `uuid()`, network
calls, filesystem reads, environment reads.

Anything non-deterministic is resolved **before** the event is emitted and baked
into the payload. Server does the I/O; the event records the result; the fold is
pure arithmetic.

```ts
// WRONG — replays differently every time
if (e.type === "seat.claimed") s.seats.push({ ...e.payload, joinedAt: Date.now() });
// RIGHT — time comes from the event
if (e.type === "seat.claimed") s.seats.push({ ...e.payload, joinedAt: e.ts });
```

## 4.3 The event/delta test

For any new frame type ask: *fold the log without it — is the state wrong?*

| Frame | State wrong without it? | Verdict |
|---|---|---|
| `contrib.accepted` | yes — cap table wrong | event |
| `draft.completed` | yes — answer text unreconstructable | event |
| 400 token deltas | no — `draft.completed` carries full text | **wire only** |

Token deltas must never enter `s.events`. Consequences if they do:
- **Replay stalls.** ~5–10k frames per session vs ~40 real events; a late joiner
  re-renders a stream that finished ten minutes ago.
- **HCS becomes impossible.** Each submit is a signed tx with consensus
  finality; thousands of sequential submits cannot happen during a live demo.
  (The ~$0.0001/message cost is the lesser problem.)
- **The evidence layer dies.** Six `contrib.accepted` messages buried in 10k
  token fragments is not human-auditable on HashScan, so "the log is the
  evidence behind the cap table" degrades to "trust our indexer".

**Cost of the split:** the server must buffer each stream while fanning out
deltas, then emit `draft.completed` with the full text once. Ten lines. A
`draft.completed` without `text` silently makes the log unreplayable and you
would discover it at MP3.

---

# 5. Vocabulary (say these words, only these)

"Draft" is overloaded three ways in the master spec. Team speech:

| Term | Meaning | Event |
|---|---|---|
| **instruction** | the human's message | `instruct` |
| **run** | one agent invocation, has a `runId` | `draft.started` / `canonical.started` |
| **answer** | the text that run produced | `draft.completed` / `canonical.completed` |
| **contribution** | human knowledge proposed for the brain | `contrib.proposed` |

"Draft" and "canonical" are adjectives on *run* and *answer*. Never on an
instruction, never on a contribution.

A contribution is **not** an agent answer, and an agent answer is **not** a
draft contribution. They are separate objects with separate lifecycles.

```
instruct → draft.started → draft.completed → ✕ discarded (default)

──────── separate loop, human-initiated, rare ────────

contrib.proposed → cosign ×2 → contrib.accepted → brain.updated {rootHash}
                                                        ↓
                            canonical runs cite it: "(per Alice's #3)"
```

---

# 6. The two lanes

A lane bundles four things that must move together: speed, proof, money, and
what the run may touch.

| | DRAFT | CANONICAL |
|---|---|---|
| Provider | fastest non-sealed (Router / Groq / OpenRouter) | sealed only — 0G Private Computer |
| Attestation | none | TEE attestation → proof chip |
| Payment | none | `payForInference(requestHash)` per run (M4) |
| Brain access | none injected, no citations | `BrainChunk[]` + citation system prompt |
| Authority gate | master A4 DRAFT rule | master A4 COMMIT rule |
| Can earn a cap-table share | no | no — only `contrib.accepted` does |
| Latency budget | sub-second, streaming | seconds, blocking, spinner + chip |

## 6.1 Why the split exists

1. **Proof is unaffordable per message.** Attestation + on-chain payment is
   seconds and testnet funds; exploration is 20 messages of "no, other way".
2. **A proof chip on every bubble is wallpaper.** Rare chip = visible claim.
3. **It is the authority model expressed in infrastructure.** Tier answers
   *who may ask*; lane answers *what happens when they do*. They must never
   disagree — a T2 must be structurally unable to trigger a canonical run.
4. **Honesty needs somewhere to fail.** `SealedUnavailable` → banner. That
   sentence only means something because a lane's contract was sealed.

## 6.2 Citations are canonical-only

Draft runs get a bare system prompt: no brain chunks, no citation instruction. A
citation attributes credit; letting an unattested exploratory run say
*"(per Alice's contribution #7)"* attaches Alice's name to something nobody
accepted and nothing can verify.

## 6.2.1 Canonical does NOT inherit conversation history

Draft carries recent turns, because exploration is a conversation. **Canonical
takes the brain plus the current question and nothing else.**

Two reasons, one discovered by testing:

1. A sealed, attested, cap-table-bearing answer must be a function of
   `(brain, question)` alone. Feeding it unattested draft output lets
   unverifiable content shape an attested result.
2. Empirically, with history in context the model answers *from the transcript*
   and stops citing entirely — the brain becomes redundant, and novelty claim #3
   silently dies. Removing history restored citation immediately.

## 6.2.2 Citation prompt wording is load-bearing

Measured against `qwen2.5-omni` (the only testnet chat model). Three variants
tested; only one worked:

| Variant | Result |
|---|---|
| Angle-bracket placeholder `(per <contributor>'s contribution #<n>)` | model echoes `<contributor>` literally |
| Rule before the brain, terse | citation dropped or malformed |
| **Rule after the brain, one concrete example** | **cites correctly; correctly silent when the brain does not cover the question** |

Keep the rule *after* the brain block and keep the worked example. If the model
changes, re-run the comparison — do not assume the prompt ports.

## 6.3 One adapter, lane as a parameter

```ts
async function infer(lane: Lane, messages: Msg[], s: Session) {
  if (lane === "draft") {
    return providers.fast.chat({ messages, stream: true });   // no brain/proof/pay
  }
  const p = providers.sealed;
  if (!p?.sealed) throw new SealedUnavailable();              // never silently downgrade
  const withBrain = [citationSystemPrompt(s.brainChunks), ...messages];
  const res = await p.chat({ messages: withBrain, stream: true });
  await hedera.payForInference(hash(withBrain));
  return { res, attestationRef: await p.getAttestation!(res.id) };
}
```

The `throw` is load-bearing. A silent fallback produces an unattested answer
wearing canonical's authority — that is the failure that turns [A3](./MASS-specs.md)
into a false claim on stage.

---

# 7. Contribution lifecycle

## 7.1 Default is: nothing happens

Agent answers are **implicitly discarded**. No accept/reject buttons on
messages, no prompt, zero clicks. The log keeps `draft.completed` for replay;
the brain never sees it.

Contribution is **opt-in and rare** — a deliberate "the agent should know this
permanently", not a verdict on every response.

Target volume for a ~30 min session:

| Event | Count |
|---|---|
| `instruct` | ~20 |
| draft runs | ~20 |
| `contrib.proposed` | ~5 |
| `contrib.accepted` | ~4 |
| canonical runs | ~3 |

The 2-of-M T3 co-sign is heavy **by design** — sized to fire ~4 times per
session. If it fires per message, both the UX and the cap table are broken.

## 7.2 Contributions are human authorship, not model output

A contribution is human knowledge going into the brain. Most are typed directly
by a person with no run involved:

> *"Our standard indemnity cap is 12 months of fees. Never agree to uncapped."*

An answer is occasionally a convenient source of text to promote — nothing more,
and the promoted text is **always editable before proposal**, so authorship stays
human.

This is not only UX. If contributions were mostly accepted model output,
novelty claim #1 degrades from *"sybil-proof contribution equity"* to *"equity
for clicking approve on an LLM"*, which a judge finds in seconds. World
sybil-resistance stops fake humans; it does nothing about a real human being
verbose. **The accept gate is what makes a share earned rather than emitted.**

## 7.3 Three entry points

| Source | `ContribSource` | When |
|---|---|---|
| Composer — primary | `"composer"` | any time; always-present "Teach the agent —" panel |
| Promote an answer | `"draft"` | hover an answer → opens composer prefilled + editable |
| Batch harvest | `"harvest"` | any time mid-session, and auto-offered at close — see §7.5 |

## 7.4 States

```
proposed ──challenged──> challenged ──resolved──> proposed
   │                          │
   │                          └──withdrawn──> ✕
   ├── cosign(T3 #1) ── cosign(T3 #2) ──> accepted ──> brain.updated
   └── screened(flagged) ──> ✕                          {storageRootHash}
```

- `contrib.screened` (immune system, master B2.2) runs **before** acceptance;
  its verdict is logged either way.
- Selfie continuity ping (B2.5) fires on `contrib.accepted`, so a share cannot
  be claimed from an unattended device. Batch variant: §7.5.4.
- Acceptance is **never blocked on storage**. See §8.2.
- Identical for live and harvested contributions — only the entry point differs.

## 7.5 Two review modes — BOTH ARE BUILT

**A. Live acceptance.** Propose → co-sign 2-of-M in front of the crew → accepted
→ brain updated, immediately. The demo beat in master [A6](./MASS-specs.md), and
what selfie continuity attaches to.

**B. Batch harvest.** Review many candidates at once, co-sign the batch, one
brain write. The answer to review fatigue — continuous "is this worth teaching?"
is too much cognitive load for a working session.

They are not alternatives and not two systems. **Harvest is the same lifecycle
of §7.4 with a different entry point and a batch wrapper.** Same
`contrib.proposed` / `cosign` / `contrib.accepted` events, same brain write.
That is what makes building both affordable.

### 7.5.1 Harvest runs mid-session too, not only at close

Triggered by any T2+ via `openHarvest`, at any point. Also auto-offered by
`closeSession()`. Mid-session harvest covers "we've been talking for 20 minutes,
let's bank what we learned" without stopping the flow each time.

### 7.5.2 Flow

1. `harvest.opened {harvestId, sinceSeq, candidateCount}` — `sinceSeq` is the
   last harvested sequence number, so harvests never re-offer the same material.
2. **Candidate extraction** — one draft-lane call over the archive slice since
   `sinceSeq`, returning `{text, sourceEventId, seat}[]`. Candidates are held in
   harvest state, **not** emitted as events until kept.
3. Crew keeps / edits / drops. Each kept candidate → `contrib.proposed
   {source:"harvest", harvestId, fromEventId}`.
4. **Batch co-sign** — 2 T3s co-sign the whole batch; each item emits its own
   `contrib.accepted` so the cap-table fold is unchanged.
5. **One** `writeBrain` call for all accepted chunks → one rootHash → one
   `brain.updated`.
6. `harvest.closed {harvestId, kept, dropped, lastSeq}`.

### 7.5.3 Extraction reads human text only

Candidates are extracted **only from `instruct` events** — never from agent
answers. Preserves the §7.2 invariant that a contribution is human authorship,
and sidesteps the unanswerable question of which seat gets credit for something
the model wrote. Kept candidates remain editable before proposal.

### 7.5.3.1 Extraction FILTERS, and is tuned for precision

An earlier revision had extraction only *pre-mark* candidates, showing every
line, because a model that misjudged a line could otherwise cost someone a
cap-table share with no way to override it.

That reasoning no longer holds: **"Teach this" now sits under every message**
(§7.3), so a missed line is one click away. With an escape hatch in place, the
review should be short — listing back every question the crew asked is the
review fatigue harvest exists to remove.

So extraction filters, tuned for **precision over recall**:

| Failure | Cost |
|---|---|
| misses a teachable line | one click on "Teach this" |
| offers a question as a candidate | noise in the review — the original complaint |

Two behaviours that must stay distinct:

- extraction returned `[]` → a real answer ("none of this was teaching"); offer
  nothing and let the crew use "Teach this".
- extraction **threw** → no judgement was made; offer every line, because a
  failure must not hide material the crew actually said.

Prompt wording is load-bearing here in the same way §6.2.2 is. Measured against
`qwen2.5-omni`: phrasings that excluded "one-off task requests" returned `[]`
for everything, because *"create a skill for X"* reads as a task request — while
in this product, defining a skill **is** the teaching. The wording that worked
asks *"if the agent remembered this forever, would it be a better team member?"*
Re-run the comparison if the model changes.

### 7.5.4 Selfie continuity on a batch

B2.5 says re-verify on each accepted contribution. For a batch: **one continuity
ping per signing T3 per batch**, logged once with the list of `contribId`s it
covers. The property that matters — a human was demonstrably present at the
moment of acceptance — is preserved; the batch is a single moment of acceptance.
Touches M3, so flag it to whoever owns the World lane.

### 7.5.5 Ordering constraint (real, easy to get wrong)

The cap table is derived at `closeSession()`. A harvest that is still open holds
un-accepted contributions that would change it.

**`closeSession()` MUST reject while any harvest is open.** Close or cancel the
harvest first. Enforce in `reduce`, not in the UI.

### 7.5.6 Scope guard

If extraction is flaky or the inference lane is down, fall back to **manual
harvest**: list every `instruct` event since `sinceSeq`, crew picks by hand. Zero
AI involved, and every other part of the flow is unchanged. Ship the fallback
first; extraction is an enhancement on top, not a dependency.

**Still do not build:** per-message auto-suggestion ("should this be saved?").
Nudge fatigue on every turn, and it drags the design back toward
approve-everything. Batched extraction is a different interaction and is fine.

---

# 8. 0G integration

## 8.1 Two artifacts, not one

Storing the whole session and curating the brain are **not** in tension. Do both.

| | Archive | Brain |
|---|---|---|
| Contents | full transcript, every event, every answer | ~4–8 accepted chunks |
| Who decides | nobody — automatic | humans, deliberately |
| Where | 0G Storage, encrypted | 0G Storage, encrypted |
| Job | evidence, audit, replay, harvest source | injected into canonical prompt |
| Cost | ~50 KB/session — negligible | context budget |

The curation question is never *what gets stored*. It is *what the agent is
instructed by, and what earns equity.*

Why the brain still cannot simply be the transcript:

1. **Equity needs countable earned units.** You cannot count "the session";
   counting messages creates a verbosity race.
2. **A transcript contains what the crew rejected.** Half a session is
   *"no, not like that"*. Inject it raw and the agent faithfully follows ideas
   killed twenty minutes earlier.
3. **Citations need discrete referents.** *"(per Alice's #3)"* requires #3 to
   exist as an object.
4. **Master honesty rule A3** defines the brain as *curated*. If brain =
   transcript, "asset-builder, not shared workspace" collapses.

## 8.2 Brain writes

```ts
// chunks live in memory; the storage write is async and never blocks acceptance
async function writeBrain(chunks: BrainChunk[], prevRoot?: string) {
  const doc = { v: 1, prevRoot, chunks, ts: Date.now() };
  const ct  = aes256.encrypt(JSON.stringify(doc), SESSION_KEY);
  const [tx, err] = await indexer.upload(new MemData(ct), RPC_URL, signer);
  if (err) throw err;
  return tx.rootHash;
}
```

- `prevRoot` hash-links every brain version → an immutable, verifiable brain
  history **from 0G Storage alone**, before Hedera is wired. Good fallback if
  HCS lands late.
- Single write queue per session. Uploads take seconds; blocking acceptance
  makes the demo feel broken. UI shows a pending chip.
- `brain.updated {storageRootHash}` is emitted **only after a real root hash
  returns**. Never fabricate one. On failure: retry queue, chunks stay in
  memory, no event.
- Encrypted blobs need `indexer.downloadToBlob()`, **not** `indexer.download()`.
  AES-256 adds a 17-byte header; ECIES 50 bytes.

## 8.3 Inference

Per master [C3](./MASS-specs.md): one adapter, three base URLs.
Start **both lanes on Router** (`pc.0g.ai` key, OpenAI-compatible) so the UI
lands early. Move canonical to the direct-broker path once `[0G LATENCY]` is
measured. If sealed latency is unusable, ship canonical on mock attestation plus
the honesty banner — degraded, not dishonest.

Pin `@0gfoundation/*` packages at exact versions. The public starter kit still
references the old `@0glabs/0g-serving-broker` namespace.

## 8.4 Keys in v1

One server-held hot wallet = session treasury; funds storage uploads and
compute. Users need no wallet until M5/M7. Keeps the World and ENS lanes
independent of this module.

---

# 9. Schema extensions (ADDITIVE — needs both builders' sign-off)

Master [C1](./MASS-specs.md) is frozen. Nothing below removes or renames an
existing member; all are additions.

```ts
type ContribSource = "composer" | "draft" | "harvest";

// payloads this module defines for existing C1 event types
type RunStartedPayload   = { runId: string; lane: Lane; instructId: string };
type RunCompletedPayload = { runId: string; lane: Lane; text: string;
                             attestationRef?: string };
type ContribProposedPayload = { contribId: string; text: string;
                                source: ContribSource; fromRunId?: string;
                                harvestId?: string; fromEventId?: string };

// new event types
| "archive.written"   // {storageRootHash, eventCount}
| "harvest.opened"    // {harvestId, sinceSeq, candidateCount}
| "harvest.closed"    // {harvestId, kept: string[], dropped: number, lastSeq}
| "harvest.cancelled" // {harvestId}
```

`verify.continuity.ok` gains an optional `covers: string[]` (contribIds) for the
batch case — see §7.5.4. Empty/absent means it covers a single acceptance, so
existing live-acceptance behaviour is unchanged.

## 9.1 Optional rename — decide before M0, not after

`draft.started` reads as "a draft was started", which is not what it means.
Cleaner:

```ts
| "run.started"    // {runId, lane: "draft" | "canonical", instructId}
| "run.completed"  // {runId, lane, text, attestationRef?}
```

Collapses four event types to two and makes lane a payload field. **Five-minute
change today; cross-module refactor tomorrow.**

**DECISION: [ ] keep frozen names   [ ] adopt run.* — owner: ____ date: ____**
Default if undecided at M0: keep frozen names.

---

# 10. Failure modes

| Failure | Behaviour |
|---|---|
| Sealed provider unavailable | canonical throws `SealedUnavailable` → honesty banner. Never downgrade silently. |
| 0G Storage upload fails | chunks stay in memory, retry queue, **no** `brain.updated` emitted, pending chip stays |
| Client disconnects mid-run | deltas dropped for that client; on reconnect it folds events and sees `draft.completed` |
| Last T3 leaves mid-contribution | per master M0: complete-then-lock; `perm.recomputed` emitted |
| Two T3s co-sign simultaneously | server is single-writer; second cosign folds onto the first, idempotent by `contribId` + seat |
| Event log diverges between tabs | impossible by construction — if observed, `apply()` is impure. Check §4.2. |
| Candidate extraction fails or is slow | fall back to manual harvest (§7.5.6); the rest of the flow is identical |
| `closeSession()` while a harvest is open | rejected in `reduce` (§7.5.5) — close or cancel the harvest first |
| Second harvest opened while one is open | rejected; one open harvest per session |
| Harvest abandoned (crew loses interest) | `harvest.cancelled`; `sinceSeq` not advanced, so nothing is lost to a later harvest |

---

# 11. Build sequence (do not reorder)

1. `types.ts` + `perms.ts` + 5 unit tests — pure, no I/O, no network.
2. WS bus + `reduce` + two tabs replaying a hardcoded event array.
3. `zg/inference.ts` on Router → draft lane streams into both tabs.
4. Contribution lifecycle: propose → cosign 2-of-2 → `contrib.accepted`.
5. `zg/storage.ts` standalone round-trip test: encrypt → upload → download →
   decrypt → deep-equal.
6. Wire 4 → 5: acceptance enqueues `writeBrain`; emit `brain.updated` only on a
   real root hash.
7. Canonical lane: inject brain chunks + citation prompt → agent cites teachers.
8. `zg/archive.ts`: write full event log on `session.closed` → `archive.written`.
9. **Harvest, manual first** (§7.5.6): `openHarvest` → list `instruct` events
   since `sinceSeq` → keep/edit/drop → `cosignBatch` → N × `contrib.accepted` →
   one `writeBrain`. Enforce the §7.5.5 close-ordering rule in `reduce`.
10. **Harvest extraction** (§7.5.2 step 2): swap the raw `instruct` list for a
    draft-lane extraction pass. Pure enhancement — step 9 must already work
    without it.

Steps 9–10 are the last in, first out under time pressure: cut 10 before 9, and
9 before anything earlier. Live acceptance (step 4) is never cut.

**DoD:** two browsers, one agent; draft streams to both; a contribution
co-signed by two seats lands in the brain on 0G Storage; a canonical answer
cites it by contributor and number; a third tab joining mid-session folds the
log and matches the other two exactly; a mid-session harvest banks 3 candidates
in one batch co-sign and one brain write, and `closeSession()` refuses while
that harvest is open.

---

*v1.1. Subordinate to MASS-specs.md v0.6. Both review modes (§7.5) are in scope.
One open decision remains: the §9.1 event rename — resolve before M0 starts.*
