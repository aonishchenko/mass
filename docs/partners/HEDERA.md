<p align="center">
  <img src="../../assets/mass-hero.png" alt="MASS — Collectively build your new AI colleague" width="760">
</p>

<h1 align="center">MASS × Hedera</h1>
<p align="center"><em>Build your next team member. Together. On the record.</em></p>

---

## What MASS is, in 30 seconds

**Every AI agent today is single-player.** One person, one private chat, one
owner. But the knowledge that makes an agent genuinely good is *collective* — it
lives in the heads of the two or three people on a team who have watched users
fail, and it leaves when they do.

**MASS is how a team builds an AI colleague together, and provably co-owns what
it becomes.** A crew of verified humans teaches a shared agent. Every accepted
contribution is attributed on an immutable log. Ownership is computed from that
log — never assigned by hand. And when the agent is hired, its fee flows back to
the humans whose knowledge it actually used.

> **The agent cites its teachers. By name.**

---

## The problem

MASS makes a promise to strangers: *your share is real, and nobody can quietly
edit it.* A company database cannot keep that promise — whoever runs it can
rewrite the record and switch off the payouts.

And the payout itself is hard in a way traditional rails handle badly: many small
amounts, to many people, across borders, triggered by machines, at a per-answer
cadence. **Contribution ownership needs a neutral ledger and cheap, native
payments. Without both, there is no product.**

## The solution

Hedera is the **money-and-memory layer** of MASS:

- **Memory** — every meaningful event is anchored to a Hedera Consensus Service
  topic as a hash. The log is the *evidence behind the cap table*: anyone can
  replay the topic and derive the same ownership numbers we show.
- **Money** — the agent pays to think (a micropayment per sealed answer), and
  when the agent is hired, its fee splits to the humans whose lines it cited.

All of it SDK-native. **No Solidity anywhere.**

---

## How people use it

| # | What the user does | What Hedera does |
|---|---|---|
| 1 | Teaches the agent; the crew co-signs a contribution | The acceptance is anchored to HCS (hash only) |
| 2 | Watches the **Anchored on Hedera** panel | Rows are read back from **Mirror Node** — the network's answer, not ours |
| 3 | Asks a canonical (sealed) question | The agent pays per inference; the memo is the request hash (x402 pattern) |
| 4 | Closes the session — **the Birth** | An HTS cap-table token mints per accepted contribution |
| 5 | An outsider hires the agent — **the First Job** | One atomic transfer fans the fee out to the crew, live on screen |
| 6 | Clicks any row | HashScan opens: topic, token, or transaction |

Nothing in that flow asks a user to think about a blockchain. They teach, they
co-sign, they get paid.

---

## What we use from Hedera

| Hedera feature | Where it runs in MASS |
|---|---|
| **Consensus Service (HCS)** | The provenance log — hash-only projections, never content |
| **Mirror Node REST** | Drives the live ticker and all metrics, so the UI shows what the network returned |
| **Micropayments (x402 pattern)** | The agent pays per sealed inference; memo = the request hash |
| **Token Service (HTS)** | The cap-table token — fungible, decimals 0, with a native **custom fractional fee** so every transfer routes a cut back to the treasury |
| **Atomic multi-party transfer** | The payroll split: one transaction, many recipients — all paid or nobody is |
| **Account Service** | Crew accounts created programmatically, so payouts have real destinations |
| **HCS-14** | The agent's identity announcement at the Birth |
| **Scheduled Transactions** | Session expiry, demonstrable on HashScan |

---

## Hedera features, put in practice in order to…

- **…make a cap table that a stranger can audit.** The HCS log *is* the evidence.
  `allocation[seat] = count(contrib.accepted)` — fold the topic yourself and you
  get our numbers. Ownership stops being a claim.
- **…let an AI agent hold up its own end of a transaction.** Every canonical
  answer settles a real Testnet payment before it counts. The agent is not a
  demo of payments; it is a participant in them.
- **…pay many humans, atomically, in one auditable movement.** A judge sees a
  single HashScan entry fanning out to several people. Sequential transfers would
  be weaker evidence and partially failable.
- **…put royalties in the asset itself, not in a contract we wrote.** HTS custom
  fees mean the cut is a property of the token. We are careful with words: it is
  a **contribution receipt with a royalty fee schedule** — never "revenue share."
- **…keep private things private.** HCS receives `{id, ts, type, actorTier, seat,
  payloadHash}` and a whitelist of correlation ids. The conversation itself never
  leaves encrypted 0G storage. The projection is built by *picking* fields, so a
  new field cannot leak by being forgotten.
- **…prove depth without a single contract.** Four native services, JS/TS SDK
  only, zero Solidity.

---

## Why Hedera is load-bearing here

Ask the test question: *would you accept a share in something where the owner can
edit the ledger and switch off the payouts?* Nobody would. Remove Hedera and the
cap table has no evidence, the log becomes editable, and the agent cannot pay
anyone. The neutrality is the product.

---

## Status

| | |
|---|---|
| **Built** | HCS anchoring with hash-only projections, Mirror-Node-driven ticker and metrics, pay-per-inference on Testnet, the payroll split maths (integer-exact, reconciliation-tested), HTS token + mint + atomic payout implemented in the chain sidecar |
| **In progress** | Wiring the Birth mint and the First Job payout into the session close (actively under development this weekend) |
| **Architecture note** | Hedera **writes** run in a sidecar service because the SDK needs gRPC, which Cloudflare Workers cannot open. **Reads** stay in the Worker against Mirror Node REST — which is exactly why "the ticker renders what the network returns" is literally true |
| **Live** | https://mass.aonishchenko33.workers.dev |
| **Verify it yourself** | `GET /api/hcs` and `GET /api/stats`, then the same topic on HashScan |

*Technical brief: [`HEDERA-TASK.md`](../HEDERA-TASK.md) · Earnings model: [`MARKETPLACE-EARNINGS.md`](../../MARKETPLACE-EARNINGS.md)*
