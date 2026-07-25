<p align="center">
  <img src="assets/mass-hero.png" alt="MASS — Collectively build your new AI colleague" width="820">
</p>

# MASS — Multiplayer Agent Session System

> **Build your next team member. Together. On the record.**
> ETHGlobal Lisbon 2026 · Team MASS

A crew of verified humans collectively builds an AI team member. Its brain grows
from accepted contributions, every contribution is attributed on an immutable
log, and ownership follows that log through a native royalty mechanism.
**The agent cites its teachers.**

This is an *asset-builder* — you raise an agent that comes with a cap table —
not a shared workspace.

---

## Table of contents
- [What it is](#what-it-is)
- [What's genuinely new](#whats-genuinely-new-three-claims-no-more)
- [How it works](#how-it-works)
  - [The agent is a repository (git-native)](#the-agent-is-a-repository-git-native)
  - [Authority model](#authority-model)
  - [Ownership & the cap table](#ownership--the-cap-table)
  - [Payment flow](#payment-flow-hedera)
  - [A brain that cites its teachers](#a-brain-that-cites-its-teachers)
  - [The Build Path](#the-build-path)
- [Putting the agent to work](#putting-the-agent-to-work)
- [Sponsor stack](#sponsor-stack)
- [The demo, end to end](#the-demo-end-to-end)
- [Honesty notes](#honesty-notes)
- [Prior art & how we differ](#prior-art--how-we-differ)
- [Documentation](#documentation)
- [Status](#status)

---

## What it is

Every AI agent today is single-player — one person, one prompt, one owner.
MASS makes building one a **multiplayer, on-the-record** activity:

1. A crew of humans joins a live session and proves they are real, unique people.
2. They instruct and steer a shared agent together.
3. When the crew accepts a contribution, it becomes part of the agent's
   **brain** — and a share of the agent's **cap table**.
4. At the end, the agent is minted as a co-owned digital employee with an
   identity, a public CV, and a royalty schedule that pays its builders when it
   earns.

Everything that happens is recorded on an immutable event log, so contribution,
ownership, and authority are all provable — not just claimed.

---

## What's genuinely new (three claims, no more)

1. **Sybil-proof contribution equity** — cap-table shares are backed by
   World-verified unique humans; the Hedera HCS log is the evidence behind the
   cap table.
2. **Live quorum authority** — the agent's permissions recompute in real time
   from the verified humans currently present.
3. **A brain that cites its teachers** — the agent attributes its answers to the
   specific human contributions they draw on.

Everything else (delegation, mandates, audit trails, iNFT minting) is
"and of course it also has" — never claimed as novel.

---

## How it works

### The agent is a repository (git-native)

An agent is physically a folder of text — values, knowledge, skills, mandates.
MASS doesn't compete with git; it stands on it. Putting the agent in a real
repository gives authorship, history, review, forking, and rollback for free.
MASS adds the four things git lacks:

- **Proof the author is a unique human** (World)
- **An immutable anchor so history can't be quietly rewritten** (Hedera)
- **A private, ownable, transferable snapshot** (0G)
- **A resolvable public identity** (ENS)

One motion: chat → *"Propose to brain"* → the agent drafts a concrete
before/after → two verified signatures → merge → hash anchored, snapshot sealed,
brain reindexed → the agent cites the lines it uses → payment follows those
lines. See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for how a contribution is
proposed, signed, and merged.

### Authority model

Authority is a live function of who is verified and present — not a static role
list. Permissions recompute whenever the crew changes.

| Tier | Gate | Unlocks |
|------|------|---------|
| **T1 Observer** | invite link | watch + read the log |
| **T2 Builder** | World Selfie Check (sybil score recorded) | instruct the agent (DRAFT lane) |
| **T3 Signer** | Orb-verified via World AgentKit | accept contributions, COMMIT actions |

- **DRAFT** actions need ≥1 Builder present. **COMMIT / MERGE** actions need two
  distinct verified signatures — the author may be one of them, so at least one
  other human always signs.
- Every World proof is **verified server-side** — rendering the widget is never
  enough.
- Selfie continuity is re-checked on each accepted contribution, so a cap-table
  share can't be claimed from an unattended device.

### Ownership & the cap table

Ownership is **computed from the repository, never hand-set** — the same
discipline as the readiness check. Only the files that shape the agent earn:
`KNOWLEDGE/`, `SKILLS/`, `SOUL.md`, `PERSONALITY.md`, `VOICE.md`. Everything else
is plumbing and earns nothing.

```
equity = 0.30 × Authorship + 0.70 × Usage
```

- **Authorship** — how much of the surviving text in the earning files you wrote
  (format-only changes don't count).
- **Usage** — how often the agent actually cites your lines when doing paid work.

Because the log is anchored on-chain and history is append-only, anyone can
recompute the Authorship Map from the repository at any commit
(`node scripts/authorship.mjs`) and get the same answer. See
[`CONTRIBUTING.md`](./CONTRIBUTING.md) for what earns ownership and the house
rules for knowledge units.

### Payment flow (Hedera)

- The session treasury (an ENS-named account) pays **per sealed inference**,
  with the request hash as the memo (an x402-style pay-per-use pattern).
- At session close, an HTS **cap-table token** mints per accepted contribution,
  carrying a **royalty fee schedule**.
- **The First Job:** an outside customer pays the agent a question fee, and the
  payment splits to the crew's wallets per the cap table — live, on screen.

### A brain that cites its teachers

The "brain" is curated, encrypted memory + instructions + skills stored on 0G.
Each accepted contribution becomes a brain chunk tagged with its contributor and
a per-contributor number. The agent's system prompt requires it to cite inline —
for example, *"(per Alice's contribution #7)"* — and never to invent citations.

### The Build Path

A first-time crew faces a blank prompt and doesn't know what an agent needs. The
Build Path fixes that: **the agent tells the crew what it still needs.** Every
agent needs twelve slots filled — purpose, soul, voice, knowledge, sources,
skills, examples, mandates, harness, tests, rate card, ownership. Readiness
(e.g. *"Agent readiness 4 / 12"*) is **derived by checking the repository**, and
clicking an empty slot drops a facilitation prompt into the composer that
interviews the crew about that part of itself. The prompts ask for tacit
knowledge — war stories, red lines, the embarrassing example — not definitions.
See [`BUILD-PATH.md`](./BUILD-PATH.md) and the slot data in
[`BUILD-PATH.json`](./BUILD-PATH.json).

---

## Putting the agent to work

Once built, the agent is a hireable, earning asset — and MASS runs its payroll.

- **The weekend's agent** is a **Technical Documentation Writer** (`AGENT.md`),
  chosen because documentation and code review are named demand categories on
  the Virtuals ACP marketplace, and doc quality is exactly the tacit,
  lives-in-two-people's-heads knowledge MASS captures and pays for.
- **Listing** — a MASS agent is an HTTP endpoint that takes a brief and returns
  a deliverable, citations, and a TEE attestation, so it lists on marketplaces
  via the API-only seller path. See
  [`LISTING-ON-VIRTUALS-ACP.md`](./LISTING-ON-VIRTUALS-ACP.md).
- **Earnings → payroll** — when a job settles, earnings sweep into the ENS-named
  Hedera treasury and the split runs: **70% to the authors of the lines cited in
  that job, 30% pro-rata to all equity holders** (minimum transfer 0.1 HBAR),
  logged to HCS against the job and its citations. Neither the marketplace nor
  the settlement layer splits a seller's earnings among the humans who built it —
  that is MASS's layer. See
  [`MARKETPLACE-EARNINGS.md`](./MARKETPLACE-EARNINGS.md).

---

## Sponsor stack

- **World** — Selfie Check (verified builders + sybil score + continuity),
  AgentKit (multi-principal signer quorum), optional Identity Check for
  regulated-session actions. All proofs verified server-side.
- **0G** — Private Computer sealed inference (TEE attestation), Storage
  (encrypted brain + log storage, first-party encryption), Agentic ID /
  ERC-7857 (mint + crew delegation), optional immune-system screening of
  contributions.
- **Hedera** — HCS event log (hash-only), Mirror Node ticker, x402-style
  pay-per-inference, HTS cap-table token with royalty schedule, HCS-14
  announcement, Scheduled expiry.
- **ENS** — Durin seat subnames, primary (reverse) names everywhere so **no hex
  address ever appears in the demo**, ENSIP-26 agent profile, brain root hash +
  HCS topic in text records, and a public CV page resolved from the agent's name.
- **Inference** — Groq / OpenRouter / 0G, all OpenAI-compatible (BYO-key
  fallback).

---

## The demo, end to end

1. **Verified seats claimed** — humans join via Selfie Check; names and sybil
   badges appear (zero hex, ever).
2. **Co-steering** — builders instruct and redirect the agent live; every
   instruction hits the ticker with authorship.
3. **A contribution is accepted** via 2-of-M co-sign, screened by the brain's
   immune system, then processed in a **sealed** run with a TEE attestation chip.
4. **The agent answers, citing its teachers.**
5. **The Birth** — the session closes: the cap table mints per the log, the
   Agentic ID mints with the crew delegated as owners, and the agent's ENS name
   resolves to its full CV — skills, who-taught-what, attestations, owners.
6. **The First Job** — an outsider pays the agent a question fee, and the split
   lands in the crew's wallets live.

> *"Built together. Owned together. Earning together. On the record."*

Full demo script, booth pitches, and video plan: [`SUBMISSION-PACK.md`](./SUBMISSION-PACK.md).

---

## Honesty notes

We keep our claims tight and honest:

- The **brain** is curated encrypted memory + instructions + skills on 0G
  Storage — **not** weight training. On-platform fine-tuning is the natural next
  step for the same asset.
- The **crew token** is a *contribution receipt with a royalty fee schedule* —
  never "revenue share," never securities language.
- Verifiability means **TEE attestation of sealed execution** — not "ZK-proven."

---

## Prior art & how we differ

- **Foundry Protocol (0G)** pools capital/data/compute into co-owned models;
  MASS pools *verified human labor*, one accepted contribution at a time.
- **AIverse (0G)** mints agents as iNFTs; MASS mints an iNFT whose encrypted
  brain carries a *provable human cap table*.
- **Argus (0G)** provides agent mandates & replayable traces; MASS's authority
  comes from a *live quorum of verified humans*, not bonded agent identity.
- **Story / OpenLedger** attribute and pay royalties on *training data*; MASS
  does it for *interactive contributions* at session granularity, sybil-resistant.
- **Mem0 group-chat attribution** tracks provenance in memory; MASS anchors it
  on-chain and makes it economically binding.

---

## Documentation

| File | Purpose |
|------|---------|
| [MASS-specs.md](./MASS-specs.md) | v0.7 git-native single source of truth — positioning, authority model, interface contracts, module cards, feature register, merge points, timeline |
| [shared-session-spec.md](./shared-session-spec.md) | Session core module — WS protocol, event sourcing & replay, draft/canonical lanes, contribution lifecycle, 0G brain + archive |
| [hedera-spec.md](./hedera-spec.md) | Hedera module — HCS provenance ledger, pay-per-inference, the payroll split, HTS cap table |
| [AGENT.md](./AGENT.md) | The weekend's agent — the Technical Documentation Writer: what it is, entry point, what earns ownership |
| [BUILD-PATH.md](./BUILD-PATH.md) | The guided flow that turns a session into a complete agent (the twelve slots) |
| [BUILD-PATH.json](./BUILD-PATH.json) | Slot data + facilitation prompts driving the Build Path (readiness is derived, not stored) |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | How a contribution is proposed, signed, merged, and what earns ownership |
| [LISTING-ON-VIRTUALS-ACP.md](./LISTING-ON-VIRTUALS-ACP.md) | Putting a co-built agent to work on the Virtuals ACP marketplace |
| [MARKETPLACE-EARNINGS.md](./MARKETPLACE-EARNINGS.md) | Reading the agent's earnings and how marketplace revenue becomes contributor payouts |
| [TASKBOARD.md](./TASKBOARD.md) | Checkbox-level execution plan per lane, with merge-point gates |
| [SUBMISSION-PACK.md](./SUBMISSION-PACK.md) | README skeleton, demo script, booth pitches, video plan, per-track checklists |
| [PITCH.md](./PITCH.md) | 4-minute pitch script, slide sequence, and an exhaustive Q&A playbook |
| [world-testing-template.md](./world-testing-template.md) | World beta testing documentation (a required prize deliverable) |
| [PROVENANCE.md](./PROVENANCE.md) | How these planning documents were developed |

---

## Status

**Building — spec v0.7 (git-native edition).** Demo Sunday 09:00 WEST, with ENS
and Hedera booth pitches Sunday AM. Weekend scope is one agent end to end — the
Technical Documentation Writer. See [`TASKBOARD.md`](./TASKBOARD.md) for the
hour-by-hour run plan and [`MASS-specs.md`](./MASS-specs.md) for the frozen
interface contracts the build follows.
