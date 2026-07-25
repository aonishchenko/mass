# MASS — Hedera Module
## Spec v1.0 — provenance ledger, payroll, audit trail
**Subordinate to [MASS-specs.md](./MASS-specs.md). Companion to
[shared-session-spec.md](./shared-session-spec.md), which owns the session core.**

Covers master-spec module **M4**. Target track: **AI & Agentic Payments on
Hedera**. Native services only — **no Solidity**, by design.

---

# 1. What Hedera is for here

Three jobs, in priority order:

1. **Make the ownership record un-rewritable.** A git history can be
   force-pushed; an HCS message cannot be withdrawn.
2. **Run the payroll.** One incoming payment splits across many humans in a
   single atomic transaction.
3. **Provide a replayable audit trail** anyone can verify without trusting us.

Novelty claim to defend: every other team will show *"an agent pays for an API
call."* Nobody else splits one payment across multiple humans according to an
on-chain evidence trail (§5).

---

# 2. Constraints discovered before building (read these first)

Four things in the original plan do not survive contact with the platform.
They are recorded here rather than silently worked around.

## 2.1 `@hashgraph/sdk` cannot run on Cloudflare Workers

Write operations (topic create, message submit, transfers, token mint) go over
**gRPC**. Workers cannot open gRPC connections, exactly as they cannot reach 0G
storage nodes on port 5678 (shared-session-spec §8).

**Resolution:** the existing Railway sidecar becomes the **chain sidecar**. It
already runs Node natively for 0G Storage; Hedera writes join it.

| Runs on Workers | Runs in the sidecar |
|---|---|
| **Mirror Node REST reads** (plain HTTPS) | topic create, message submit |
| session, UI, event bus | HBAR transfers, payroll split |
| stats aggregation | HTS token create + mint |

This split is a feature, not a workaround: the **read** path — the one the demo
claims ("the ticker renders from the network") — genuinely runs in the Worker
against Mirror Node, with no sidecar involved.

## 2.2 A royalty fee schedule cannot be attached to a fungible token

`CustomRoyaltyFee` is valid **only** on `NON_FUNGIBLE_UNIQUE`. The cap table is
fungible (units per contributor), so HARD REQUIREMENT 4 as written is not
constructible.

**Resolution:** the cap-table token carries a **`CustomFractionalFee`**, which is
the fungible equivalent and achieves the stated intent — *if ownership is ever
transferred, value flows back to holders*. A cut of every cap-table transfer is
routed to the treasury for redistribution.

**Say "fractional fee schedule", not "royalty", when describing the fungible
token.** Claiming a royalty fee on a fungible token is checkable in ten seconds
on HashScan and would undermine the honesty discipline in [A3](./MASS-specs.md).

If a true `CustomRoyaltyFee` is wanted for the demo, it belongs on the **agent
NFT**, not the cap table. Out of scope here; 0G already mints the Agentic ID.

## 2.3 `scripts/authorship.mjs` does not exist

HARD REQUIREMENT 3 step 2 resolves cited lines to authors via an Authorship Map
produced by `node scripts/authorship.mjs --json`. That script is specified in
MASS-specs v0.7 (git-native model) but **is not built**.

**Resolution:** `resolveAuthors()` is written against a narrow interface with two
implementations. The citation-based one activates the moment the script lands;
until then the fallback splits the authorship share by **accepted-contribution
count**, which is the same evidence the cap table already uses.

```ts
interface AuthorshipSource {
  /** seat -> weight, for the lines a job actually cited. */
  weights(citations: Citation[]): Promise<Record<string, number>>;
}
```

The payroll maths, the atomic transfer and the reconciliation check are all
independent of which implementation is in play, so nothing here blocks on it.

## 2.4 Per-crew testnet accounts are custodial

Creating an account per crew member means the server holds each private key.
That is fine for a testnet demo and it is what makes payouts land in distinct
accounts (the Success criterion), but **do not describe it as self-custody**.
The honest sentence is: *"testnet accounts provisioned and custodied by the
session treasury; production would use the crew's own accounts."*

---

# 3. Configuration

```ts
interface HederaConfig {
  topicId: string;              // one per agent
  treasuryAccountId: string;
  capTableTokenId?: string;
  network: "testnet";
}
```

Secrets (sidecar env + `wrangler secret`):

| Var | Purpose |
|---|---|
| `HEDERA_OPERATOR_ID` | treasury account, pays fees |
| `HEDERA_OPERATOR_KEY` | its private key (DER or hex) |
| `HEDERA_TOPIC_ID` | set after first `createTopic()` |
| `HEDERA_CAPTABLE_TOKEN_ID` | set after first `mintCapTable()` |
| `HEDERA_NETWORK` | `testnet` |

Mirror Node base (no key needed):
`https://testnet.mirrornode.hedera.com/api/v1`

Explorer: `https://hashscan.io/testnet`

---

# 4. HCS — the provenance ledger (HARD REQUIREMENT 2)

## 4.1 Hash-only payloads

One topic per agent. The submitted message is a **hash-only projection**:

```ts
{ id, ts, type, actorTier, seat?, contribId?, storageRootHash?, hederaTxId?, payloadHash }
```

**Why `seat` is published (revision, 2026-07-25).** The first cut followed master
C1 exactly — `{id, ts, type, actorTier, payloadHash}` — and that turned out to be
too thin to support our own headline claim. `actorTier: "T3"` says *a* Signer
co-signed; it does not say **which**. So the cap table could NOT be reconstructed
from HCS alone, while novelty claim #1 says *"the HCS log is the evidence behind
the cap table."* A judge checking that would have found it unsupported.

Seat ids are opaque randoms (`s_41aa4329bf2d`). Display names never touch HCS —
they live in the encrypted 0G archive. Publishing the seat costs no privacy and
is the difference between a log that hints and a log that proves.

`contribId`, `storageRootHash` and `hederaTxId` are correlation keys, so a reader
can group two cosigns with their acceptance, or follow a brain update to the 0G
root it produced. All are ids or hashes. Never content.

**`contrib.accepted` is emitted by the system**, so `actor.seat` is empty on the
one event the cap table counts — the credited seat comes from its payload. Miss
that and the whole exercise is pointless.

**Never submit** message content, human names, document text, seat tokens or
storage keys. The content stays encrypted on 0G; HCS carries only the commitment
that proves it has not changed.

This is enforced at the boundary by construction, not by discipline:

```ts
// The projection is built by picking fields, never by deleting them — an
// added event field cannot leak by being forgotten in a blocklist.
const toHcs = (e: MassEvent) => ({
  id: e.id,
  ts: e.ts,
  type: e.type,
  actorTier: "tier" in e.actor ? e.actor.tier : "system",
  payloadHash: e.payloadHash,
});
```

## 4.2 What gets logged

Anchor-worthy events only:

`seat.claimed` · `contrib.cosigned` · `contrib.accepted` · `brain.updated`
(carries the git commit hash) · `payment.executed` · `job.settled` ·
`captable.minted` · `payout`

**Not** logged: token deltas, `instruct`, `draft.*`. Those are conversation, not
provenance — see shared-session-spec §4.3 for why putting them on HCS is
impossible in practice as well as wasteful.

> **Volume honesty.** Transaction count is 20% of the score under "Success", and
> it is trivially gameable. We log what genuinely deserves anchoring. Inflating
> the number with junk messages is dishonest, obvious to a judge reading the
> topic, and would poison every other claim we make.

## 4.3 The ticker reads from Mirror Node, not local state

This is the demo claim, so it must be literally true. The Worker polls:

```
GET /api/v1/topics/{topicId}/messages?limit=50&order=desc
```

decodes the base64 `message`, and renders **that**. If the network has not yet
returned a message, it is not on the ticker. Mirror Node lags consensus by a
second or two; the UI shows a "pending anchor" state rather than pretending.

Every row with a transaction gets a HashScan link:

```
https://hashscan.io/testnet/transaction/{txId}
https://hashscan.io/testnet/topic/{topicId}
https://hashscan.io/testnet/token/{tokenId}
https://hashscan.io/testnet/account/{accountId}
```

---

# 5. Payments

## 5.1 Pay-per-inference (HARD REQUIREMENT 1)

The qualification bar. The agent pays for its own **canonical** (sealed) run —
draft runs are free, matching the lane split in shared-session-spec §6.

```
canonical.completed
  -> TransferTransaction treasury -> compute provider
  -> memo = inference request hash          (x402 pattern)
  -> payment.executed { hederaTxId, amount, kind: "inference" }
```

Started from the `x402-pay-per-use` template in `npx create scaffold-har` rather
than written from scratch; the README says so.

The memo being the request hash is what makes it auditable: anyone can take the
`payloadHash` from the HCS message and find the payment that settled it.

## 5.2 The payroll split (HARD REQUIREMENT 3 — the novelty)

```ts
settleJob(jobId):
  1. read the job's citations from the event log
  2. resolve each cited line to its author        (§2.3)
  3. 70% across authors of cited lines, weighted by citation count
     30% pro-rata across all cap-table holders
  4. ONE TransferTransaction with many recipients — atomic
  5. transfers below 0.1 HBAR accrue to a pooled balance instead
  6. emit payout { jobId, transfers, hederaTxId }
```

**One transaction, not N.** Atomicity is the point: either every contributor is
paid or nobody is, and a judge sees a single HashScan entry fanning out to
several named humans. N sequential transfers would be both weaker evidence and
partially-failable.

The dust rule matters because citation weights produce long tails; paying 0.0001
HBAR costs more in fees than it transfers. Pooled remainder carries to the next
settlement and appears in the reconciliation.

## 5.3 Reconciliation

Asserted in tests and displayed in the UI:

```
inflows == payouts + pooledRemainder + networkFees
```

If this does not balance, the payroll is wrong and the cap-table claim is
unsupported. It is the single most load-bearing test in this module.

---

# 6. HTS cap table (HARD REQUIREMENT 4)

```ts
mintCapTable(allocations):
  - TokenCreateTransaction, FUNGIBLE_COMMON, decimals 0
  - CustomFractionalFee (see §2.2 — NOT CustomRoyaltyFee)
  - units per contributor derived from the log, never hand-set
  - emit captable.minted { tokenId, allocations }
```

Allocations come from `capTable(session)` in
[src/core/reduce.ts](./src/core/reduce.ts) — a fold over `contrib.accepted`.
**Never hand-edit.** The whole claim is that the numbers are derived from
evidence; a manual override makes the token a claim rather than a proof.

Contributors must be **associated** with the token before they can hold units.
Treasury-held allocation is the fallback when a crew member has no account yet.

---

# 7. Bonus items

| Item | Status | Notes |
|---|---|---|
| HCS-14 agent identity | build | one message announcing the agent's universal ID; nearly free |
| Scheduled Transactions | build | "revoke agent authority" at T+60min, crew must re-sign to extend. Log the schedule ID, link in README, **cut from the live demo** |
| Mirror Node REST | required anyway (§4.3) | name it explicitly in the README — it is on their optional list |
| Hedera Agent Kit | only if under 30 min | counts as SDK usage + AI-workflow credit |

**Skipped deliberately:** UCP discovery, Hedera CLI automation, ERC-8004 — low
value per hour against this rubric.

---

# 8. Success metrics (20% of score)

`GET /api/stats` returns real counts, rendered in the UI and quoted at the booth:

```ts
{
  accountsCreated: number;      // treasury + one per crew member
  hcsMessages: number;          // counted from Mirror Node, not locally
  transactions: number;
  payouts: number;
  distinctHumansPaid: number;
  totalHbarDistributed: number;
}
```

`hcsMessages` is counted **from Mirror Node**, for the same reason the ticker is:
a number we computed ourselves is a claim, a number the network returns is
evidence.

---

# 9. Data model additions

```ts
interface PayoutRecord {
  jobId: string;
  citations: { file: string; lineStart: number; lineEnd: number }[];
  transfers: { seat: string; accountId: string; amountTinybar: number }[];
  hederaTxId: string;
  pooledRemainder: number;
}
```

New event types (additive to C1, per shared-session-spec §9):

```ts
| "job.settled"   // {jobId, amountTinybar, hederaTxId}
| "payout"        // PayoutRecord
| "hcs.anchored"  // {eventId, topicSequenceNumber, consensusTimestamp}
```

`hcs.anchored` closes the loop: it records that a local event reached consensus,
so replay can show which events are anchored and which are still pending.

---

# 10. Build order

1. Sidecar: operator client, `createTopic`, `submitMessage`. **Verify on HashScan.**
2. Worker: Mirror Node reader + ticker + HashScan links. *(HR2 done)*
3. Pay-per-canonical-inference with request-hash memo. *(HR1 done — qualification bar)*
4. Crew accounts + `/api/stats`.
5. `settleJob` split + reconciliation test. *(HR3 — the novelty; fight for this)*
6. `mintCapTable` with fractional fee. *(HR4)*
7. HCS-14 announce, scheduled expiry.

Steps 1–3 clear the track's qualification bar. **If time runs out, step 5 matters
more than step 6** — the split is the differentiator; another HTS token is not.

---

# 11. Definition of done

1. A real testnet payment, agent-triggered, with a HashScan link.
2. The ticker renders from Mirror Node; entries link to HashScan.
3. One incoming payment splits to multiple named humans in **one** transaction.
4. Cap-table token exists with a fee schedule; balances derived from the log.
5. `GET /api/stats` returns real counts; the UI shows them.
6. README has Setup / Architecture / Payment flow + artefacts table.
7. **Works on the deployed URL**, not just localhost.

---

# 12. Not built yet (keep this honest and current)

- Authorship-Map-based citation weighting — falls back to accepted-contribution
  count until `scripts/authorship.mjs` exists (§2.3).
- Crew accounts are custodial (§2.4).
- ACP / OKX marketplace integration is **adapter-ready, not live**. Never say
  otherwise.
- No Solidity anywhere, deliberately.

---

*v1.0. Subordinate to MASS-specs.md. Constraints in §2 were found by checking the
platform before building; revisit them before changing any of §4-§6.*
