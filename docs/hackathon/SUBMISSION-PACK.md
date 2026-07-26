# MASS SUBMISSION PACK — everything judges see, in one place
**Owner: N. Populate continuously; finalize after FREEZE (Sat ~22:30).**

---

## 1. README skeleton (copy into repo README.md and fill)

```markdown
# MASS — Multiplayer Agent Session System
**Build your next team member. Together. On the record.**

A crew of verified humans collectively builds an AI team member. Its brain
grows from accepted contributions, every contribution is attributed on an
immutable log, and ownership follows that log through a native royalty
mechanism. The agent cites its teachers.

## What's genuinely new (three claims, no more)
1. **Sybil-proof contribution equity** — cap-table shares backed by
   World-verified unique humans; the Hedera HCS log is the evidence.
2. **Live quorum authority** — the agent's permissions recompute in real time
   from the verified humans present.
3. **A brain that cites its teachers** — answers attribute the specific human
   contributions they draw on.

## Prior art & how we differ
- **Foundry Protocol (0G)** pools *capital/data/compute* into co-owned models;
  MASS pools *verified human labor*, one accepted contribution at a time.
- **AIverse (0G)** mints agents as iNFTs; MASS mints an iNFT whose encrypted
  brain carries a *provable human cap table*.
- **Argus (0G)** provides agent mandates & replayable traces; MASS's authority
  comes from a *live quorum of verified humans*, not bonded agent identity.
- **Story/OpenLedger** attribute & pay royalties on *training data*; MASS does
  it for *interactive contributions* at session granularity, sybil-resistant.
- **Mem0 group-chat attribution** tracks provenance in memory; MASS anchors it
  on-chain and makes it economically binding.

## Honesty notes
- The "brain" is curated encrypted memory + instructions + skills on 0G
  Storage — not weight training. 0G fine-tuning (live) is the natural next
  step for the same asset.
- The crew token is a contribution receipt with a royalty fee schedule.
- Verifiability claims are TEE attestations of sealed execution.

## Architecture
[diagram — export from spec Part; show: browser crew → session server →
World / ENS(Durin) / Hedera(HCS·HTS·Schedule) / 0G(PC·Storage·Agentic ID)]

## How the payment flow works (Hedera)
Treasury (ENS-named account) pays per canonical (sealed) inference, memo =
request hash (x402 pattern, built on scaffold-har). At close, HTS cap-table
token mints per accepted contributions in the HCS log, with a royalty fee
schedule. First Job: incoming payment splits to crew per cap table.

## How the cap table derives from the log
allocation[seat] = count(contrib.accepted where actor.seat == seat).
Each mint references the underlying HCS sequence numbers.

## Sponsor features used
- **World:** Selfie Check (T2 gate + sybil score + continuity), AgentKit
  (multi-principal T3 quorum), [Identity Check regulated toggle if built];
  all proofs verified server-side.
- **0G:** Private Computer sealed inference (attestation per canonical run),
  Storage (encrypted brain, log storage, first-party encryption), Agentic ID
  (ERC-7857 mint + crew delegation), [immune-system screening].
- **Hedera:** HCS event log (hash-only), Mirror Node ticker, x402-style
  pay-per-inference, HTS cap-table token w/ royalty schedule, HCS-14
  announcement, Scheduled expiry (see HashScan), [ERC-8004 if built].
- **ENS:** Durin seat subnames, primary names for crew+agent+treasury
  (zero hex anywhere), ENSIP-26 agent profile, brain root hash + HCS topic in
  text records, public CV page resolved from the name, [ENSIP-25 loop if built].

## Setup
[env vars, pinned SDK versions, run commands, deployed URL]

## What's next
Contribution licensing terms (Story-style) · listing the co-built employee on
agent marketplaces (OKX AI is Claude Code/OpenClaw-compatible) · platform
fine-tuning of the brain · dynamic Agentic ID upgrades across sessions.
```

---

## 2. Demo script (~2:45, rehearse twice, N must be able to run alone)
1. **(0:00)** "Every AI agent today is single-player. We build them together —
   on the record." Alice claims seat: Selfie Check → subname + primary name +
   sybil badge appear. ZERO hex on screen, ever.
2. **(0:25)** Bob joins. Draft lane streams fast; Bob redirects mid-stream;
   both instructions hit the ticker with authorship.
3. **(0:50)** Alice proposes a contribution (NDA review checklist). [If B2.6:
   Bob challenges, Alice amends — visible human disagreement.] 2-of-M co-sign
   → immune-system screen passes (verdict in ticker) → SEALED canonical run →
   proof chip clicked, TEE attestation shown → brain.updated + payment in
   ticker w/ HashScan link.
4. **(1:35)** The payoff line: ask the agent a question. It answers **citing
   its teachers** — "per Alice's contribution #7…"
5. **(1:50)** **THE BIRTH:** session closes → cap-table tokens mint per the
   log (royalty schedule on HashScan) → Agentic ID mints, crew delegated as
   ERC-7857 users (delegation list on screen) → the agent's ENS name now
   resolves to its full CV: skills, who-taught-what, attestations, owners.
6. **(2:20)** **THE FIRST JOB:** an outsider (judge's phone) pays to ask it
   one question; the payment splits to the crew per cap table, live on screen.
   "Built together. Owned together. Earning together. On the record."

**Failure insurance:** backup screen-recording of the full arc queued; expiry
beat shown only as HashScan link; honesty banner if sealed lane is down.

## 3. ENS booth pitch (Sunday AM, 60 seconds, N)
"MASS turns ENS names into careers. Every crew member gets a Durin subname
whose text records hold their World attestation; the agent's name resolves to
its entire employment record — skills, who taught what, its brain's root hash,
its owners. Primary names everywhere: there is not a single hex address in our
demo. And the name outlives the hackathon: it's the permanent identity of a
co-owned digital employee." [Show CV page. If B3.2: "ENSIP-25 closes the loop
to its ERC-8004 registration."]

## 4. Hedera booth pitch (Sunday AM, both)
Innovation: contribution equity — HCS log IS the cap table's evidence.
Integration depth: HCS + HTS royalty token + x402-style payments + HCS-14 +
Scheduled expiry, all SDK-native (no Solidity), built on scaffold-har.
Validation: The First Job — a real inbound payment split to real humans.
Pitch beat: show one HCS message and the mint that references it.
(Run their validate-submission skill BEFORE this pitch; bring its output.)

## 5. Video plan
- Master (~3:30) = demo script above, screen-captured, voiceover.
- 0G cut <3:00 — lead with proof chip + brain + Agentic ID delegation.
- Hedera cut <=5:00 — lead with payment flow + log→cap-table derivation.
- ENS: live demo at booth + master link.

## 6. Per-track submission checklists
**All tracks:** public repo · README above · deployed URL · demo video ·
team names + Telegram & X · FINALIST JUDGING OPT-IN · prize-selection cap
verified `[____]`.
**0G:** contract addresses · Agentic ID explorer link · "which 0G features"
paragraph · proof-of-0G-Compute inference · video <3:00.
**World:** working end-to-end flow · server-side verification demonstrable at
pitch · testing documentation (world-testing-template.md, filled) ·
[Identity: necessity + minimization note §5 of that doc].
**Hedera:** >=1 real payment on testnet · README payment-flow section ·
video <=5:00 · validate-submission run.
**ENS:** functional demo, no hard-coded values (grep-for-hex done) · video or
live · IN-PERSON booth presentation Sunday morning.
