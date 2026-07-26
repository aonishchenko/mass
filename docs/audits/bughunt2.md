# Bug Hunt 2 — second full-repo audit

Follow-up to [`bughunt1.md`](./bughunt1.md), after the Hedera work landed and the
UI pass (`ui.ts`, pagination, HashScan links, double-submit guards). Audited at
`c610b39`, including a live look at the deployed session.

Severity: 🔴 critical · 🟠 correctness/integrity · 🟡 UX/polish · ⚪ nice-to-have.

**Ownership note:** Oleksiy is on the **World** files this round
(`src/world/*`, `web/src/world.tsx`). Findings in that area are reported but
**not** fixed here. Fixes in this round's PR stay outside them.

---

## Still open from round 1 (unchanged, and now the biggest gap)

### R1-A2. 🔴 The Birth still does not mint, and the First Job still does not pay
**Where:** `src/session-do.ts` `closeSession()` — writes the archive and emits
`session.closed`, nothing else. Verified again at `c610b39`:
`mintCapTable`, `payoutSplit`, `splitPayment`, `createAccount`,
`createCapTableToken`, `announceIdentity` have **zero runtime callers**.
**Why it matters:** the sidecar implementations are complete and the split maths
is tested — but no session can ever produce a cap-table token, a payout, or an
HCS-14 announcement. `captable.minted`, `job.settled` and `payout` are in the
anchor whitelist and are never emitted. This is the demo's closing beat and the
core of two Hedera tracks.
**Fix:** call the chain, in `closeSession()`: create/collect accounts → mint per
the cap-table allocation → emit `captable.minted`; then a `receiveJobPayment`
entry point → `splitPayment()` → `payoutSplit()` → emit `payout`.
**Design decision needed first:** `mintCapTable` wants a `privateKey` per
holder, and `createAccount` returns one. Storing crew private keys in the DO is
a real security choice — decide between custodial demo accounts (documented as
such) or holders bringing their own account ids. **Do not ship key storage by
accident.**

### R1-A5. 🟠 "N events awaiting consensus" is still wrong
**Where:** `web/src/Hedera.tsx:77` — `eventCount - stats.hcsMessages`.
`eventCount` counts *all* events; only ~8 of ~28 event types are ever anchored.
The counter is therefore permanently large and grows forever. *(Fixed in this
round's PR.)*

---

## New findings

### B1. 🔴 Agent answers render raw markdown
**Where:** `web/src/Thread.tsx` `AssistantMessage` — assistant text goes through
`CitedText` into a `whitespace-pre-wrap` div. No markdown library is installed.
**Why it matters:** live sessions show `#### Benefits:` and
`- **Enhanced Decision-Making**:` literally — hashes, asterisks and all — across
the entire main pane. It is the first thing anyone looks at, and it makes a
correct answer look broken.
**Fix:** render through `react-markdown` + `remark-gfm`, keeping citation
highlighting applied to text nodes. *(Fixed in this round's PR.)*

### B2. 🟠 "Co-sign batch" is offered when it can only fail
**Where:** `web/src/Rail.tsx` — the button is enabled whenever a harvest is open,
including when the list says *"nothing new said since the last harvest"* and when
the viewer is not a Signer. The server answers `"nothing kept in this harvest"`.
**Fix:** disable on empty candidates or non-Signer, and state the reason.
*(Fixed in this round's PR.)*

### B3. 🟠 There is hex on screen, which breaks the zero-hex claim on sight
**Where:** `web/src/Rail.tsx` — `brain root 0x27432ee77e196d4c…`.
**Why it matters:** the ENS pitch is *"there is not a single hex address in our
demo"*. A judge running that test sees `0x…` and does not stop to check that it
is a content hash rather than an address. `scripts/grep-hex.mjs` only catches
hardcoded literals in source, so it passes.
**Fix:** label it explicitly as a content hash and drop the `0x` prefix in the
UI. *(Fixed in this round's PR.)*

### B4. 🟠 The cap table is keyed by display name, and display names are not unique
**Where:** `web/src/Rail.tsx` cap-table list renders `seats[seat]?.name`.
**Why it matters:** a live session showed two seats both named `Ol`. The cap
table then shows two indistinguishable rows — for the one number the product
exists to make unambiguous. There is also no validation on the name field
(1-character and junk names get seats).
**Fix:** render the seat's ENS subname (already unique per session) as the
identity, with the display name secondary; validate the name on claim.
*(Fixed in this round's PR.)*

### B5. 🟠 A failed HCS anchor is silent and never retried
**Where:** `src/session-do.ts:310` — `anchorEvent(...).catch(console.error)`.
**Why it matters:** if consensus submission fails (network, fees, sidecar down),
that event is simply never anchored. Nothing retries, nothing backfills, and no
one is told — so the log can quietly develop holes. The claim "the HCS log is
the evidence behind the cap table" only holds if it is complete.
**Fix:** track unanchored events and retry with backoff (the brain write already
uses a retry-on-next-write pattern); surface a count in the Hedera panel.

### B6. 🟠 The Hedera panel stops polling
**Where:** `web/src/Hedera.tsx:68` — `load(); setTimeout(load, 4000);` inside an
effect keyed on `eventCount`. It fetches twice, then stops until the event count
changes.
**Why it matters:** consensus lands seconds later, so the panel is routinely
showing stale numbers and a stale "awaiting consensus" line during a quiet
moment — exactly when a judge is reading it.
**Fix:** poll on an interval while the panel is mounted. *(Fixed in this
round's PR.)*

### B7. 🟡 The agent rambles, burying the citation beat
**Where:** `src/zg/inference.ts` — no `max_tokens`, and the draft lane has no
brevity instruction.
**Why it matters:** an observed answer was a ~500-word generic essay (Benefits /
Challenges / Practice Exercises) with no citations, filling the screen. The
"cites its teachers" moment is the payoff and it gets buried.
**Fix:** cap `max_tokens` and add one brevity line to the draft prompt.
*(Fixed in this round's PR.)*

### B8. 🟡 In dev mode, one-human-one-seat cannot be enforced
**Where:** `web/src/world.tsx` dev fallback mints
`nullifier: dev_<cred>_<uuid>` — random per claim.
**Why it matters:** the duplicate-human check keys on the nullifier, so during
credential-free rehearsal every claim looks like a different person. This is how
a live room accumulated eight junk seats.
**Fix:** derive the dev nullifier from the typed name so it is stable per person.
**⚠️ World file — left for Oleksiy.**

### B9. 🟡 Falling the Builder tier back to Orb makes the sybil gate undemonstrable
**Where:** `src/world/context.ts` + `web/src/world.tsx` (`WORLD_SELFIE_PRESET=orb`).
**Why it matters:** a sensible workaround for the partner-gated Selfie Check, but
Orb scores 0.95, so **every** seat lands well above the threshold and the
Observer downgrade can never trigger. World's hard requirement is "a low sybil
score visibly changes what that person can do", and their feedback headings ask
specifically about *Orb vs Selfie cohorts* — with both tiers on Orb there is no
difference to show.
**Fix:** keep the fallback, but make the threshold demonstrable — e.g. a
documented demo override that puts one seat below it, or ensure at least one
participant uses Selfie Check if beta access lands.
**⚠️ World file — left for Oleksiy.**

### B10. 🟡 Unseated visitors are shown controls they cannot use
**Where:** `web/src/Rail.tsx` — Co-sign, Co-sign batch and Cancel render for
someone with no seat. They are disabled but unexplained.
**Fix:** hide or explain. *(Partly addressed in this round's PR.)*

### B11. ⚪ `usePending` can clear early in a busy room
**Where:** `web/src/ui.ts:32` — pending clears when `view.events.length` grows
*at all*. In a live session another person's `instruct` or a `perm.recomputed`
clears your button's pending state before your own action lands.
**Fix:** clear on the specific event that resolves the action, or accept it and
document the trade-off.

### B12. ⚪ Duplicated HashScan id normalization
`toHashscanTxId` in `src/hedera/mirror.ts` and `hashscanTx` in `web/src/ui.ts`
implement the same rule twice. Harmless today; drift-prone.

### B13. ⚪ Mirror Node messages decoded with `atob`
`src/hedera/mirror.ts:65` — `atob` is byte-wise, so any non-ASCII in a topic
message decodes to mojibake. Our projections are ASCII today.

### B14. ⚪ The log ticker shows type only
`#77 perm.recomputed` — no seat, no timestamp. Fine as a ticker, thin as
evidence when a judge is looking for a specific event.

---

## Operational (not code)

### O1. Old rooms permanently show everyone as "Signer · 0.87"
Seats claimed before the World integration carry the old hardcoded mock in their
event log, and the log replays forever. Such a room can never demonstrate the
tier difference or the quorum-lock beat.
**Do the demo in a fresh room.** Consider a banner when a room contains
pre-verification seats.

### O2. PR #1 now overlaps Oleksiy's active area
[PR #1](https://github.com/aonishchenko/mass/pull/1) touches `src/world/verify.ts`
and the World section of `src/session-do.ts` — which is where this round's work
is happening. **Merge it soon** or it will need a rebase.

---

## Suggested order

1. **R1-A2** — wire the Birth mint + First Job payout (decide the key-custody
   question first). Biggest remaining gap in the whole product.
2. **B1** — markdown rendering. Highest visible impact for one dependency.
3. **B5** — anchor retry, so the log is actually complete.
4. **B2, B3, B4, B6, B7** — correctness and demo polish *(this round's PR)*.
5. **B8, B9** — World items, for Oleksiy.
6. **B10–B14** — polish.
