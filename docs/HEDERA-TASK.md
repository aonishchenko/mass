# TASK: Hedera integration for MASS — prize-track eligibility

## Context

MASS is a live multiplayer session where a crew of verified humans collectively
builds an AI agent. Contributions are merged into a git repo; ownership (a cap
table) is derived from who wrote the surviving lines and how often the agent
cites them. World makes each contributor a verified unique human; ENS gives every
participant and the agent a name; 0G holds the encrypted brain and the agent's
identity.

**Hedera is the money-and-memory layer** — the neutral rails that make MASS's
central promise ("your share is real and nobody can quietly edit it") true.
Three things run on Hedera: an **immutable event log** (HCS) that is the evidence
behind the cap table, **pay-per-inference and payout settlement** (the agent pays
to think, and its earnings split to the humans who taught it), and a **cap-table
token with a native royalty schedule** (HTS). No Solidity — all SDK-native.

Stack: TypeScript, Cloudflare Workers backend, React frontend, WebSocket event
bus, Durable Objects. Deployed at https://mass.aonishchenko33.workers.dev.
Existing Hedera code: `src/hedera/client.ts` (`anchorEvent`, `payForInference`,
`shouldAnchor`), `src/hedera/mirror.ts` (`readTopicMessages`, `hashscan`,
`topicMessageCount`, `accountBalance`), `src/hedera/split.ts` (+ test). Events
already emitted: `hcs.anchored`, `payment.executed`. Sibling docs:
`MARKETPLACE-EARNINGS.md`, `LISTING-ON-VIRTUALS-ACP.md`, `MASS-specs.md`
(A6 demo arc, M4 Hedera module card, C1 event schema).

## Target tracks (one build, three prizes)
1. **AI & Agentic Payments on Hedera — up to $3,000.** AI agents executing
   payments on Testnet (Hedera Agent Kit / OpenClaw ACP / x402). ← primary.
2. **Tokenization on Hedera — up to $1,500.** Create/manage tokens via HTS;
   show the full token lifecycle on Testnet.
3. **"No Solidity Allowed" — Build with Hedera SDKs — up to $1,000.** JS/TS SDK
   only, no Solidity, ≥2 native services.

## Judging criteria (per the published requirements — build to these)
- **Real payments on Hedera Testnet**, provable on HashScan. Never a fabricated
  tx id.
- **Depth of native integration** — MASS uses **four** native services (HCS,
  HTS, Scheduled Transactions, Mirror Node) and **no Solidity**, which clears
  tracks 1–3 at once.
- **Token lifecycle** (create → mint → custom-fee/royalty → transfer/payout)
  visible on HashScan (track 2).
- **GitHub repo + README (payment-flow section) + ≤5-minute demo video.**
- Run the Hedera **`validate-submission`** skill before the booth pitch and bring
  its output.

## Reference docs (read them — do NOT guess SDK signatures)
- Hedera JS/TS SDK (`@hashgraph/sdk` / Hiero): HCS (TopicCreate/TopicMessageSubmit),
  HTS (TokenCreate/Mint/CustomFees), ScheduleCreate, Mirror Node REST.
- Hedera Agent Kit + skills plugin; `scaffold-har` (x402 + payments-scheduler
  templates) as the `payForInference` base.
- HCS-14 (agent identity announcement); x402 payment pattern.
- HashScan (topic, token, tx explorers) for evidence links.
Do NOT introduce a Solidity contract — it forfeits track 3 and isn't needed.

---

## The one sentence to make a Hedera judge lean in
> "MASS is an AI agent that pays Hedera to think and pays real humans when it
> earns: every canonical answer settles a micropayment on Testnet, the HCS log
> is the *evidence behind a cap table*, and when the agent is hired its fee
> splits to its teachers via an HTS royalty token — all SDK-native, no Solidity,
> every transaction on HashScan."

---

## HARD REQUIREMENT 1 — HCS is the evidence behind the cap table
The log is not decoration; it is what makes ownership auditable by a stranger.

Build (foundation exists in `client.ts`/`mirror.ts`):
- Anchor each durable event to an HCS topic **hash-only** — HCS receives only
  `{id, ts, type, actorTier, payloadHash}` (C1). Payloads never touch HCS.
- The **Mirror Node read-back drives the live ticker** — the UI shows what the
  network returned, not what we believe we sent (`/api/hcs`).
- The cap table is a fold of `contrib.accepted` in the log; anyone replaying the
  HCS topic derives the same shares.

Acceptance: the HashScan topic sequence matches local event ids; the ticker is
Mirror-Node-sourced; folding the topic reproduces the cap table.

## HARD REQUIREMENT 2 — x402-style pay-per-inference (agentic payment)
The agent pays for its own canonical (sealed) runs. This is the "AI agent
executing payments" the track asks for.

Build (foundation: `payForInference`, `payment.executed`):
- On every `canonical.completed`, transfer HBAR from the ENS-named treasury to
  the compute account, **memo = the inference request hash** (x402 pattern, built
  on `scaffold-har`). Draft runs are free (lane split).
- Emit `payment.executed { kind:"inference", hederaTxId, requestHash }`; the UI
  shows a HashScan link. Never fabricate a tx id — a failed payment emits nothing.

Acceptance: each canonical answer has a real Testnet payment whose memo hash
matches a `payloadHash` on HCS — take a hash off the log, find the payment that
settled it.

## HARD REQUIREMENT 3 — HTS cap-table token with a royalty fee schedule
Ownership is a real token with native royalties — no Solidity, pure HTS.

Build:
- At the Birth (`session.closed`), `mintCapTable(alloc)` creates/mints an HTS
  token whose allocation equals accepted contributions per seat, with a
  **royalty custom fee schedule** attached natively.
- Each mint references the underlying HCS sequence numbers (evidence linkage).
- Language discipline: it is a **"contribution receipt with a royalty fee
  schedule,"** never "revenue share," never securities language.

Acceptance (track 2 lifecycle): create → mint → royalty schedule → transfer, all
visible on HashScan; the scripted-log mint allocates correctly.

## HARD REQUIREMENT 4 — The First Job: inbound payment splits to the crew
The demo's closing beat and the strongest possible "agentic payment" proof: an
outsider hires the agent and real humans get paid, live.

Build (foundation: `src/hedera/split.ts`):
- `receiveJobPayment()` (the agent is hired) → `payoutSplit(alloc)` distributes
  per `MARKETPLACE-EARNINGS.md`: **70% to the authors of the lines cited in that
  job, 30% pro-rata to all equity holders**, minimum transfer 0.1 HBAR.
- Log a `payout` event referencing the jobId and the citations; the reconciliation
  `sum(inflows) == sum(payouts) + pooled + fees` must hold.

Acceptance: ≥1 real inbound Testnet payment splits to ≥2 crew accounts, on
screen, each transfer on HashScan; reconciliation balances.

## HARD REQUIREMENT 5 — No Solidity, ≥2 native services (track 3)
Prove the whole thing is SDK-native.

Build:
- Use **only** the Hedera JS/TS SDK. Services in play: **HCS** (log), **HTS**
  (cap table + payouts), **Scheduled Transactions** (Req 6), **Mirror Node**
  (ticker/metrics) — four, well past the two-service bar.
- A one-paragraph README note listing the services and asserting "no Solidity,"
  with HashScan links for each.

Acceptance: a reviewer can confirm no contract is deployed and ≥2 native services
are used with evidence.

## HARD REQUIREMENT 6 — HCS-14 announcement + Scheduled expiry
Two native touches that round out the integration.

Build:
- `announceHcs14(agentMeta)` — publish the agent's HCS-14 identity announcement
  at the Birth (ties to the ENS name + Agentic ID).
- `scheduleExpiry(at)` via the Schedule Service (build-only is fine) — a
  scheduled transaction with a HashScan link, demonstrating the service.

Acceptance: the HCS-14 announcement and a scheduled transaction both resolve on
HashScan.

---

## UI requirements
- Every payment, mint, and payout shows a **HashScan link** (topic / token / tx).
- The ticker renders from **Mirror Node**, not local state (already `/api/hcs`).
- The treasury is shown by its **ENS name**, never hex (zero-hex doctrine; ties
  to `ENS-TASK.md`).
- Payment chips on canonical answers; a live cap-table / earnings panel
  (`EARNINGS` block from `MARKETPLACE-EARNINGS.md` §6).
- `/api/stats` surfaces network-counted metrics (HCS messages, treasury balance,
  payouts, distinct humans paid) — from the network, not local counters.

## Worker interfaces (extend `src/hedera/*`; ship a mock for keyless rehearsal)
```ts
anchorEvent(env, event): Promise<{ sequenceNumber, txId }>     // exists
payForInference(env, { to, amountHbar, requestHash }): Promise<{ txId }> // exists
mintCapTable(env, alloc): Promise<{ tokenId }>                 // + royalty fee schedule
receiveJobPayment(env): Promise<{ txId, amount }>
payoutSplit(env, alloc): Promise<{ txIds }>                    // 70/30, see split.ts
scheduleExpiry(env, at): Promise<{ scheduleId }>               // build-only
announceHcs14(env, agentMeta): Promise<void>
// reads (exist): readTopicMessages, topicMessageCount, accountBalance, hashscan
```
Env (already scaffolded in `.dev.vars.example`): `HEDERA_OPERATOR_ID/KEY`,
`HEDERA_TOPIC_ID`, `HEDERA_COMPUTE_ACCOUNT_ID`, `HEDERA_INFERENCE_PRICE_HBAR`,
`HEDERA_CAPTABLE_TOKEN_ID`. Keep a `hederaEnabled(env)` guard so the app runs
without credentials (mock/degraded), never blocking a session on consensus.

## Deliverable (for the submission + booth)
- README **payment-flow section**: treasury → per-inference x402 → cap-table
  mint → First Job split, with the cap-table derivation formula.
- Run the Hedera **`validate-submission`** skill; fix what it flags; bring its
  output to the booth.
- ≤5-minute demo video leading with the payment flow and the log→cap-table
  derivation; HashScan links in the description.
- Booth pitch (aligns with `PITCH.md` §4): "contribution equity — the HCS log IS
  the cap table's evidence."

## DO NOT BUILD (loses a track or breaks honesty)
- **Any Solidity contract.** Forfeits track 3 and is unnecessary — HTS does
  royalties natively.
- **Payloads on HCS.** Hash-only. Plaintext stays encrypted on 0G.
- **Fabricated tx ids or projected numbers.** Quote only what settled on chain
  (`MARKETPLACE-EARNINGS.md` §8). A failed payment emits nothing.
- **Blocking the session on consensus.** Anchor AFTER broadcasting; a failed
  anchor must not lose a local event.
- **"Revenue share" language.** It's a contribution receipt with a royalty fee
  schedule.

## Definition of done
1. Events anchored to HCS (hash-only); ticker is Mirror-Node-sourced; folding the
   topic reproduces the cap table.
2. A real Testnet payment per canonical run, memo hash == an HCS `payloadHash`.
3. HTS cap-table token minted with a royalty fee schedule; lifecycle on HashScan.
4. The First Job: ≥1 inbound payment splits to ≥2 crew accounts, live;
   reconciliation balances.
5. No Solidity; ≥2 (we ship 4) native services, with HashScan evidence.
6. HCS-14 announcement + a scheduled transaction resolve on HashScan.
7. Everything on the deployed URL against Testnet; `validate-submission` clean.

---

## Why this makes the Hedera team proud (integration map)
| Hedera surface | MASS source |
|---|---|
| HCS hash-only anchor + Mirror ticker | `src/hedera/client.ts`, `mirror.ts`, `/api/hcs` |
| x402 pay-per-inference | `payForInference`, `payment.executed` |
| HTS cap-table token + royalty schedule | the cap-table fold (`src/core/reduce.ts`) → mint |
| First Job payout split (70/30) | `src/hedera/split.ts` (+ test) |
| Named treasury (zero hex) | `ENS-TASK.md` (primary name on the treasury account) |
| Evidence per share | HCS sequence numbers referenced by each mint/payout |

Hedera is where MASS's promise stops being a slogan: the log can't be edited, the
payments are real, and the royalty split is native — so a contributor's share is
something a stranger can verify and the agent can actually pay out.
