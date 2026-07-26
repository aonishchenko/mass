# TASK: 0G integration for MASS — prize-track eligibility

## Context

MASS is a live multiplayer session where a crew of verified humans collectively
builds an AI agent. Contributions are merged into a git repo; ownership (a cap
table) is derived from who wrote the surviving lines and how often the agent
cites them. World verifies each human; Hedera anchors the log and settles
payments; ENS gives everyone a name.

**0G is the brain, the compute, and the identity** — the three things that make
the agent a real, ownable, private asset rather than a chat wrapper. The agent
thinks on **0G Compute** (sealed, TEE-attested inference), its **brain lives on
0G Storage** (first-party encrypted, hash-linked, ownable), and it is minted as
an **Agentic ID (ERC-7857 iNFT)** the crew co-owns. Critically, the brain **cites
its human teachers** — every canonical answer attributes the contributions it
used, and those citations resolve to real, screened knowledge chunks.

Stack: TypeScript, Cloudflare Workers backend, React frontend, WebSocket event
bus, Durable Objects. Deployed at https://mass.aonishchenko33.workers.dev.
Existing 0G code: `src/zg/inference.ts` (`runInference` draft/canonical lanes,
`extractCandidates`), `src/zg/storage.ts` (`writeBrain`, `writeArchive`),
`src/zg/crypto.ts` (first-party encryption), `services/zg-storage` (sidecar).
Events already emitted: `brain.updated { storageRootHash }`, `archive.written`,
`canonical.completed { attestationRef }`. Sibling docs: `MASS-specs.md` (A3
honesty rules, C2 brain chunk, C3 provider adapter, M6 module card), `AGENT.md`.

## Target track
1. **Best AI Product on 0G — $6,000** (1st $3,000 / 2nd $2,000 / 3rd $1,000).
   End-user agent using 0G Compute (sealed inference); **proof of 0G Compute**;
   Agentic ID deployment link; working demoable product; GitHub; ≤3-min video.

(Secondary, if we iterate post-event: **"Keep Building on 0G"** continuity track,
up to $1,500 — link a dated prior commit + a changelog.)

## Judging criteria (per the published requirements — build to these)
- **Proof of 0G Compute usage** — a real sealed inference with a fetchable **TEE
  attestation**, shown live. This is the make-or-break requirement.
- **Agentic ID deployment link** — the ERC-7857 iNFT on a 0G explorer, with crew
  delegation.
- **Working, demoable end-user product** (not a library) — MASS is a full app.
- **GitHub repo + ≤3-minute demo video**; an architecture diagram helps.

## Reference docs (read them — do NOT guess SDK signatures or endpoints)
- 0G Compute / Private Computer (OpenAI-compatible router): sealed vs standard
  trust modes, attestation retrieval per response. Base URL + model list at
  `/v1/models` (testnet: `qwen2.5-omni`, tee_attested).
- 0G Storage SDK (`@0gfoundation/0g-storage-ts-sdk`): upload/download, root hash;
  **pin the SDK version** — old flow-contract tutorials are wrong.
- Agentic ID / ERC-7857 (iNFT): mint + delegated users (`delegateUser`).
- 0G first-party (client-side) encryption: plaintext never reaches the network.
Do NOT claim "ZK-proven" — it is **TEE attestation of sealed execution** (A3).

---

## The one sentence to make a 0G judge lean in
> "MASS is a co-owned AI employee whose brain is an encrypted, hash-linked asset
> on 0G Storage, who thinks on 0G Compute under a TEE attestation you can click
> and verify, who cites the specific humans who taught each answer, and who is
> minted as an ERC-7857 Agentic ID its crew provably co-owns — a real 0G AI
> product, end to end."

---

## HARD REQUIREMENT 1 — Sealed canonical inference on 0G Compute (proof of Compute)
The one requirement that decides the track. Canonical (permanent, cap-table-
bearing) answers must run sealed and carry a verifiable attestation.

Build (foundation: `runInference` with `lane`, `result.sealed`,
`result.attestationRef`):
- **Two lanes, two keys** (trust modes fixed at key creation): draft = fast,
  unsealed (`ZG_ROUTER_KEY`); canonical = **sealed/Private** (`ZG_ROUTER_KEY_SEALED`).
  Canonical is a function of `(brain, question)` alone — never fed draft output.
- Fetch the **TEE attestation** per canonical run; emit
  `canonical.completed { attestationRef }`.
- `ZG_SEALED=required` throws rather than silently degrading; unset → degraded +
  an **honesty banner** ("Unsealed mode — no attestation for this response").

Acceptance: a canonical answer returns a real attestation the UI can display and
a judge can verify; the draft lane streams fast and unsealed.

## HARD REQUIREMENT 2 — The encrypted brain on 0G Storage (ownable asset)
The "brain" is curated, **first-party encrypted** memory on 0G Storage — not
weight training (A3). It is what the crew actually owns.

Build (foundation: `writeBrain`, `writeArchive`, `src/zg/crypto.ts`):
- On each accepted contribution, write the brain (`BrainChunk[]`) to 0G Storage
  with client-side encryption; **hash-link versions** via `prevRoot`; emit
  `brain.updated { storageRootHash }`. Never fabricate a root hash.
- The write is **queued off the acceptance path** — storage never blocks the
  session; a pending chip shows until a real root lands.
- The root hash is published to the agent's ENS record and the HCS log, so the
  brain's identity is portable and verifiable.

Acceptance: the brain round-trips (write → root → download → decrypt); the root
hash resolves and is linked from the agent's ENS profile.

## HARD REQUIREMENT 3 — The brain cites its teachers (the signature beat)
MASS's defining feature and a uniquely-0G one: attribution baked into the asset.

Build (foundation: `BrainChunk { contributor, contribNumber, content, screened }`,
C2 citation system prompt):
- The canonical system prompt requires inline citations —
  `(per <contributor>'s contribution #<n>)` — and forbids inventing them.
- Citations resolve to real chunk ids in the encrypted brain; the UI highlights
  them and links each to the contributor (their ENS name) and cap-table share.

Acceptance: a canonical answer cites a real chunk that resolves to the human who
taught it; an unresolvable citation is treated as a bug, not a feature.

## HARD REQUIREMENT 4 — Brain immune system (sealed screening)
Each proposed contribution is screened by a **sealed** inference before it can
enter the brain — a second, defensive use of 0G Compute.

Build (`screenContribution(chunk)` → `{ verdict, attestationRef }`):
- Run screening on the sealed lane before acceptance; emit
  `contrib.screened { verdict, attestationRef }`; a flagged chunk never reaches
  the brain or the cap table.

Acceptance: a malicious/junk contribution is caught by a sealed screen, verdict
logged with an attestation, visible in the ticker.

## HARD REQUIREMENT 5 — Agentic ID (ERC-7857) mint + crew delegation
The deployment link the track asks for, and how co-ownership becomes on-chain.

Build (`mintAgenticId(meta)`, `delegateUser(tokenId, address)`):
- At the Birth, mint the agent as an ERC-7857 iNFT whose sealed metadata points
  at the brain root; **delegate the crew as co-users** (per T3/signer).
- Surface the **explorer link** and the delegated-user list in the UI and the
  submission.

Acceptance: the Agentic ID is live on a 0G explorer with ≥2 delegated users; the
link is in the README/submission.

## HARD REQUIREMENT 6 — Sealed archive of the full session (durability)
At close, the entire event log is sealed to 0G Storage so the session is
replayable and ownable, not just live state.

Build (foundation: `writeArchive`):
- On `session.closed`, encrypt + upload the full event array; emit
  `archive.written { storageRootHash, eventCount }`; link it from the CV/record.

Acceptance: the archive root resolves; replaying it reproduces the session.

---

## UI requirements
- A **proof chip** on canonical answers → opens the TEE attestation (Req 1).
- The **honesty banner** whenever a run is unsealed (A3) — never imply a seal
  that didn't happen.
- A brain **pending chip** while a root write is in flight (Req 2).
- **Citation highlighting** in canonical output, linked to contributors (Req 3).
- The **Agentic ID explorer link** + delegated-user list (Req 5).
- 0G Storage root hashes shown (brain + archive), zero hex for identities (names).

## Worker interfaces (extend `src/zg/*`; keep the mock/degraded path)
```ts
// exists
runInference(env, lane, messages, brainChunks, onToken): Promise<{ text, sealed, attestationRef }>
writeBrain(env, chunks, prevRoot): Promise<string>     // root hash
writeArchive(env, events): Promise<string>
// to build (C4 / M6)
getAttestation(responseId): Promise<AttestationRef | null>
screenContribution(env, chunk): Promise<{ verdict, attestationRef }>
mintAgenticId(env, meta): Promise<{ tokenId, explorerUrl }>
delegateUser(env, tokenId, address): Promise<void>
```
Env (already in `.dev.vars.example`/`wrangler.jsonc`): `ZG_ROUTER_URL`,
`ZG_ROUTER_KEY`, `ZG_ROUTER_KEY_SEALED`, `ZG_SEALED`, `ZG_DRAFT_MODEL`,
`ZG_CANONICAL_MODEL`, `ZG_STORAGE_RPC`, `ZG_STORAGE_INDEXER`, `ZG_PRIVATE_KEY`
(throwaway wallet), `SESSION_KEY` (first-party encryption). PIN SDK versions.

## Deliverable (for the submission + booth)
- A **"which 0G features"** paragraph: Compute (sealed canonical + screening),
  Storage (encrypted brain + archive, first-party encryption), Agentic ID
  (ERC-7857 mint + delegation).
- **Proof-of-0G-Compute**: the attestation, shown live and linked.
- **Agentic ID explorer link** with delegated users.
- ≤3-minute demo video leading with the proof chip → brain → Agentic ID
  delegation; an **architecture diagram** (browser crew → DO → 0G Compute /
  Storage / Agentic ID, with World/ENS/Hedera around it).
- Record the measured latency: `[0G LATENCY: __ tok/s | sealed models: __]`.

## DO NOT BUILD (breaks honesty or the track)
- **"ZK-proven" claims.** It is **TEE attestation of sealed execution** (A3).
- **Feeding draft output into the canonical lane.** Canonical = `(brain, question)`
  only, or the citation is meaningless and unattested content leaks into an
  attested answer.
- **Fabricated root hashes or attestations.** No real root → no `brain.updated`.
- **Claiming weight training / fine-tuning.** The brain is curated encrypted
  memory + instructions + skills; on-platform fine-tuning is the roadmap line.
- **Unpinned Storage SDK.** Old flow-contract tutorials are wrong; pin versions.
- **Blocking acceptance on storage.** Queue the write; show a pending chip.

## Definition of done
1. Canonical answers run sealed on 0G Compute with a fetchable TEE attestation
   shown live; draft streams fast/unsealed; honesty banner when degraded.
2. The encrypted brain round-trips on 0G Storage; hash-linked roots; root linked
   from the agent's ENS record.
3. A canonical answer cites a real chunk resolving to the human who taught it.
4. A contribution is caught by a sealed screen; verdict + attestation logged.
5. Agentic ID (ERC-7857) live on a 0G explorer with ≥2 delegated crew users.
6. The full session archives to 0G Storage at close and replays.
7. Everything works on the deployed URL; ≤3-min video + architecture diagram +
   "which 0G features" paragraph ready.

---

## Why this makes the 0G team proud (integration map)
| 0G surface | MASS source |
|---|---|
| Sealed canonical inference + attestation | `src/zg/inference.ts`, `canonical.completed` |
| Draft/canonical lane split (two trust-mode keys) | `runInference` + `ZG_SEALED` |
| Encrypted, hash-linked brain on Storage | `src/zg/storage.ts`, `crypto.ts`, `brain.updated` |
| Cite-your-teachers | `BrainChunk` metadata (C2) + citation prompt |
| Sealed immune-system screening | `screenContribution` (to build) + `contrib.screened` |
| Agentic ID (ERC-7857) + delegation | mint at the Birth (to build) → explorer link |
| Sealed session archive | `writeArchive`, `archive.written` |

0G is what makes MASS an *asset*, not a chat: the brain is encrypted and ownable,
the thinking is provable, the answers are attributed, and the whole thing is
minted as an identity the crew co-owns — the most complete "AI product on 0G" a
judge will see this weekend.
