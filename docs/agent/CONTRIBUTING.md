# Contributing to this agent

This repository *is* the agent. Changing these files changes what it knows, how
it writes, and what it may do. Contributions are reviewed, signed, and recorded,
and they carry ownership.

## Not sure what to contribute?
Open the Build Path (`BUILD-PATH.json`). It lists the twelve things this agent
needs and which are still empty. Pick one and it will interview you about it.

The most valuable contribution is almost always a **war story**: the last time
you watched a reader fail, and exactly where they stopped. That is worth more
than any style rule, and the agent can cite it forever.

## How a contribution happens
1. **Propose.** In a live MASS session, click **Propose to brain**. The agent
   drafts a concrete change: which file, which lines, and why.
2. **Sign.** Two distinct verified humans sign the merge. The author may be one
   of them, so at least one other person always signs.
3. **Merge.** On merge: the commit hash is anchored to the public ledger, the
   encrypted snapshot and search index are rebuilt, and the agent is reindexed.

Commits carry these trailers:
```
Verified-Human: <proof reference>
Signed-By: <seat>, <seat>
```
A commit without a valid `Verified-Human` trailer cannot be merged.

## What earns ownership
| Earns | Earns nothing |
|---|---|
| `KNOWLEDGE/**` | `HARNESS/**` |
| `SKILLS/**` | `INDEX/**` |
| `SOUL.md` | `TESTS/**` |
| `PERSONALITY.md` | `CAPTABLE/**` |
| `VOICE.md` | `OPS/**`, `CHANGELOG.md` |

**Your share of the agent** is your accepted contributions divided by all
accepted contributions. Every acceptance is anchored to Hedera with a `humanRef`
— a truncated hash of your World nullifier — so the split can be recomputed from
the public topic and is keyed to a verified unique human, not a display name.

**When the agent is hired**, the fee splits **70% by use** (whose knowledge that
job actually drew on) and **30% by ownership** (the shares above). Use is
measured server-side and validated against the knowledge actually supplied to the
model, so a citation the model invents earns nobody anything.

Payouts are **computed and shown, not executed** — see `docs/PAYOUT-DESIGN.md`.

## House rules for knowledge units
- One idea per paragraph. Units are cited by line range, so keep lines meaningful.
- Write the rule *and* the failure it prevents. "Show the credential shape,
  because auth is where most readers stop" beats "document authentication".
- Quantify where you can: "verified against v2.4, March 2026" beats "recent".
- Prefer the specific failure you witnessed over the general principle.
- No copyrighted text, and never lift wording from another product's docs.
  Record every source and its rights status in `SOURCES/RIGHTS.md` first.

## Never force-push
History is append-only. A rewritten history no longer matches the ledger and
invalidates everyone's ownership record.
