# Payout design

**Status: settlements are computed and shown. No money moves.**

This documents how contributors get paid, why nothing is transferred yet, and
what has to be true before it is.

---

## Why nothing transfers this weekend

Two facts, both plainly true:

1. **The agent is not live on a marketplace.** Nothing is hiring it, so there is
   no inbound revenue to divide.
2. **Nobody has linked a payout account.** There is no destination for a share.

We could have created custodial accounts and moved test HBAR between them on
stage. We decided not to. A transfer between accounts we control, funded by us,
paid to nobody real, demonstrates that our arithmetic runs — not that anyone got
paid. It is exactly the kind of claim the rest of this project has been busy
removing.

**What we do instead:** compute the settlement precisely, publish it, and label
it as calculated. `GET /api/settlement` returns what each human would receive for
the last job and why. Every number is real; the payment is explicitly absent.

---

## The rule

```
70%  by USE        — whose knowledge the job actually drew on
30%  by OWNERSHIP  — each person's share of everything the agent has been taught
```

**Ownership** is the cap-table fold: your accepted contributions over all
accepted contributions.

**Use** is measured, not asserted. See [`src/core/attribution.ts`](../src/core/attribution.ts):

- every knowledge chunk enters the prompt tagged with an opaque marker;
- the model repeats the markers of anything it uses;
- **every returned marker is checked against the set we actually supplied** — an
  id we never showed it is discarded, so a hallucinated citation cannot earn
  money;
- chunks retrieved but not cited earn a small floor share, because a model that
  forgets to cite should not silently zero out a contributor.

The arithmetic is integer-only and reconciles exactly: paid + held == total.
A payroll that loses tinybar to floating point cannot be audited, and audit is
the whole claim.

---

## How money will actually reach people

Three phases. Nothing here requires re-doing what exists.

### Phase 1 — accrue (what runs today)

Every settled job produces a statement keyed to `humanRef` — the truncated hash
of a contributor's World nullifier. That key is stable across sessions and cannot
be edited by the person it names, so balances accrue correctly even before
anyone has an account.

A share with no destination is **held**, never absorbed by us, and shown as such.

### Phase 2 — link an account (self-custody)

A contributor optionally pastes a Hedera account id at any time — when they join,
or months later when they want to be paid. Their accrued balance becomes payable.

**Why self-custody rather than custodial accounts we create:**

| | Custodial | Self-custody *(chosen)* |
|---|---|---|
| Who holds the key | We do | The contributor does |
| Demo friction | None | None — linking is optional and deferred |
| What we must disclose | "We hold your money and your key" | Nothing |
| Failure mode | We lose a key, everyone's funds are gone | One person's problem, not ours |
| Unwinding later | Migrate everyone off our custody | Nothing to unwind |

The friction argument for custodial accounts only holds if linking is required at
signup. It isn't: you can teach the agent, own a share, and see your balance
without ever pasting an account. The only thing an account unlocks is withdrawal.

### Phase 3 — claim

A contributor with a linked account claims their accrued balance. Payment is one
atomic Hedera transfer fanning out to everyone claiming — one HashScan entry
showing several named humans paid at once, which is far stronger evidence than
N sequential transfers.

Dust below the minimum transfer stays pooled and accrues to the next claim rather
than being written off.

---

## Marketplace integration

The agent already publishes everything a marketplace needs, on its ENS name:

| What a marketplace needs | Where it is |
|---|---|
| A stable endpoint | `agent-endpoint[a2a]` (ENSIP-26) |
| What it does | `agent-context` (ENSIP-26) |
| Machine-readable card | `/.well-known/agent.json` (ENSIP-27) |
| Price and turnaround | `com.mass.rateCard`, and `RATE_CARD` in `src/core/settle.ts` |
| Proof of identity | ERC-8004 registration + the ENSIP-25 link |

**One price, one source.** The rate card lives in `settle.ts` and is published to
ENS from there, so the marketplace listing, the agent card and the settlement can
never quote different numbers.

When a job settles on Virtuals ACP or OKX, the flow is:

```
marketplace settles  →  treasury receives  →  settle() computes the split
                     →  balances accrue by humanRef  →  contributors claim
```

Only the last two steps are new work. The split is already computed on every job.

---

## What is deliberately not built

- **No transfers.** Stated above.
- **No custodial keys.** We hold none and want none.
- **No projected earnings.** We show what a job did pay out on paper, never what
  the agent "could" earn.
