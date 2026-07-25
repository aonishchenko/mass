# READING THE AGENT'S EARNINGS
## Where the numbers live, what to watch, and how marketplace revenue becomes contributor payouts
**Verify in the live tools before quoting a number. Dashboards and endpoints change.**

> **STATUS: this document is the design, not the build.** As of today the code
> computes ownership as *share of accepted contributions* and does **not** run
> payouts: the `0.30 × authorship + 0.70 × usage` formula, the Authorship Map,
> `scripts/authorship.mjs`, and the marketplace listing described below are all
> specified and unbuilt. Nothing here should be quoted as a live capability.

---

## 0. THREE PLACES THE TRUTH LIVES
| Layer | Source | Answers |
|---|---|---|
| **Marketplace** | ACP Visualizer, agent wallet | Did we get hired? Did we deliver? Were we paid? |
| **Chain** | Basescan (ACP settles on Base), HashScan (our treasury and payouts) | Did the money actually move? |
| **Ours** | HCS log + Authorship Map | Whose knowledge earned it, and what does each contributor get? |
Only the third layer answers the question MASS exists to answer.

## 1. MARKETPLACE: THE ACP VISUALIZER
- **Sandbox tab** — pre-graduation agents. Ours appears here after its first
  interaction. Use it to watch job status during testing.
- **Agent-to-Agent (A2A) tab** — graduated agents only. Being here means the
  Butler agent and other buyers can reach us.
- Each interaction shows a **coloured status tab** for its current phase, so you
  can see jobs moving through request → negotiation → transaction → evaluation.
- **Withdraw** button per agent opens a modal showing both the **Agent Wallet**
  and your **Connected Wallet**, and lets you move funds between them.
- Failure notifications exist, so you do not have to sit watching the dashboard.

**Watch daily during the beta:**
1. Jobs received
2. Jobs completed vs **expired** (SLA breaches)
3. Consecutive failures — **10 in a row and the agent is automatically ungraduated**
4. Agent wallet balance
5. Progress toward graduation: 10 successful sandbox transactions, including 3
   consecutive with our own test buyer

## 2. CHAIN: THE UNARGUABLE LAYER
- **Base** — the agent wallet address on Basescan shows every settlement into
  the agent, with timestamps and amounts. This is the source of truth for
  marketplace revenue.
- **x402 traffic** — x402scan.com is useful for seeing ecosystem-level volume
  and where demand is concentrated. Context, not accounting.
- **Hedera** — HashScan shows our treasury account, the HTS cap-table token, and
  every `PAYOUT` transfer to contributors, each with a memo referencing the job.

## 3. OURS: WHAT NOBODY ELSE COMPUTES
The marketplace tells you the agent earned. Only our layer tells you **whose
teaching earned it**.

```
For each settled job:
  1. Read the job's citations (file + line range) from the HCS log
  2. Resolve each cited line to its author via the Authorship Map
  3. Split: 70% across cited authors, 30% pro-rata to all equity holders
  4. Transfer on Hedera, minimum 0.1 HBAR (smaller amounts pool)
  5. Log a PAYOUT message referencing the jobId and the citations
```

**The reconciliation that matters:**
```
sum(marketplace settlements)  ==  sum(treasury inflows)
sum(treasury inflows)         ==  sum(payouts) + pooled + fees
```
If those do not balance, something is wrong upstream. Check before anything else.

## 4. THE PER-CONTRIBUTOR VIEW (what a teacher wants to see)
For each contributor, from our own data:

| Metric | Where it comes from |
|---|---|
| Authorship share | `node scripts/authorship.mjs --json` |
| Lines cited across paid jobs | HCS `JOB_EXECUTED` citation vectors |
| Usage share | citations to their lines ÷ all citations |
| Equity | `0.30 × authorship + 0.70 × usage` |
| Earned to date | sum of their `PAYOUT` transfers |
| Pending | accrued below the 0.1 HBAR threshold |
| Best-earning contribution | the single unit with the most citations |

That last row is the most motivating number in the product. It tells someone
exactly which thing they taught is paying, which makes them teach more of it.

## 5. THE PER-AGENT VIEW (is this agent a good business?)
- **Revenue per job** and **jobs per day**
- **Completion rate** (completed ÷ received) — the number that keeps graduation
- **Cost per job**: sealed inference paid from the treasury per canonical run
- **Margin** = revenue per job − inference cost per job
- **Citation concentration**: if 80% of revenue traces to two knowledge units,
  the agent is thin. That is a prompt to teach it more, and the Build Path tells
  the crew where.

## 6. HOW TO SURFACE IT IN MASS
Minimum useful version, in the session sidebar:
```
EARNINGS
  Jobs completed        12
  Earned                14.3 HBAR
  Paid to crew          10.0 HBAR   (70% by citation)
  Pooled                 1.2 HBAR   (below threshold)
  Your share             4.1 HBAR   ← per seat
  Top earner    KNOWLEDGE/docs/where-readers-get-stuck.md:7  (Bob)
```
Everything above is derivable from the HCS log plus the Authorship Map. Nothing
needs a database, and any stranger can recompute it.

## 7. A WEEKLY ROUTINE ONCE IT IS LIVE
1. Visualizer: completion rate, expiries, consecutive failures.
2. Basescan: settlements match the visualizer.
3. HashScan: treasury inflows match settlements; payouts match the split rule.
4. `verify-captable.ts`: independent recompute still matches the published root.
5. Citation concentration: which units earn, which are dead weight.
6. Feed 5 back into the Build Path so the crew teaches where the money is.

## 8. HONESTY RULES FOR REPORTING
- Never present sandbox numbers as production numbers.
- Never present ecosystem-wide x402 volume as ours.
- When quoting earnings publicly, quote what settled on chain, not what a
  dashboard projected.
- Contributors see their own numbers and the totals. No private accounting.
