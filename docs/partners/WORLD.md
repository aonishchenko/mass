<p align="center">
  <img src="../../assets/mass-hero.png" alt="MASS — Collectively build your new AI colleague" width="760">
</p>

<h1 align="center">MASS × World</h1>
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

AI is absorbing knowledge work, and the people whose expertise makes an agent
valuable are erased by it. Ask any team that has built an internal agent who owns
it: the answer is *"whoever's account it's on."*

To fix that, you have to answer one question honestly — **who taught this agent
what?** — and pay accordingly. But the moment a share of something valuable
depends on "I contributed," you have created an incentive to fake being many
people. **Contribution equity is unbuildable without proof of unique humanity.**

## The solution

MASS makes contribution provable and ownable:

1. Verified humans join a live session and teach a shared agent.
2. The crew co-signs what is worth keeping; accepted contributions enter the
   agent's brain and its cap table.
3. Ownership is *computed* from the record, not claimed.
4. The agent goes to work, and its earnings split to its teachers.

**World is the keystone.** It is what makes step 1 real and step 3 trustworthy.

---

## How people use it

| # | What the user does | What World does |
|---|---|---|
| 1 | Opens the session link, types their name, clicks **Verify & join** | **Selfie Check** proves they are a unique human |
| 2 | Gets a seat with a visible tier badge and a sybil score | The score decides what they are allowed to do |
| 3 | Talks to the agent normally, teaching it as they go | Only verified **Builders** may instruct and propose |
| 4 | Clicks **Become a Signer**, verifies with Orb | **AgentKit** delegates their authority to the session agent |
| 5 | Two Signers co-sign a contribution → it enters the brain | The quorum is recomputed live from who is present |
| 6 | A Signer closes their laptop | Authority drops on screen, instantly, for everyone |

The whole flow takes about 20 seconds per person, in a browser, with no wallet
and no seed phrase in sight.

---

## What we use from World

| World feature | Where it runs in MASS |
|---|---|
| **Selfie Check (Beta)** | Gates the **Builder** tier — the right to instruct the agent and propose contributions |
| **Sybil score** | A live risk signal per seat; below threshold a seat is **Observer only** and cannot earn equity |
| **AgentKit (Orb-backed)** | Gates the **Signer** tier — multi-principal delegation to the shared session agent |
| **Server-side proof verification** | Every proof is checked against World's cloud API *on our server*; the browser can never assert "verified" |
| **Nullifier (unique-human id)** | Enforces **one verified human, one seat** — the anti-sybil guarantee under the cap table |
| **IDKit + backend-signed `rp_context`** | The in-browser flow, with the request authenticated by our RP key |

---

## World features, put in practice in order to…

- **…make a share of ownership impossible to farm.** Every cap-table share traces
  to a World-verified unique human. Without this, one person with ten browser
  profiles owns the agent.
- **…gate capability by assurance level, not just identity.** Selfie Check earns
  you the right to *teach*; Orb via AgentKit earns you the right to *commit*. A
  weak credential leaves you an Observer — verified, but not trusted with equity.
- **…give an AI agent an authority that lives and breathes.** The agent's
  permissions are recomputed in real time from the verified humans present. Two
  Signers in the room unlocks consequential actions; one Signer leaving locks
  them again, mid-session, on screen.
- **…prove the check actually happened.** Our server calls World's verify
  endpoint, and every verification is recorded and viewable at
  `/api/verify/log`. A forged proof gets a `401`.

> **What we deliberately did *not* build:** agent reputation, human-backed
> content generation, or human-backed *benefits* (cheaper calls, discounts). We
> use AgentKit's human-verification primitive only — never to give an agent
> better terms.

---

## Why World is load-bearing here

Take World out and the product does not degrade — it collapses. Equity becomes
farmable, the quorum becomes theatre, and "provable co-ownership" becomes a
slogan. It is the one integration whose absence invalidates every other claim
MASS makes.

---

## Status

| | |
|---|---|
| **Built** | Server-side verification, sybil-gated tiers, live quorum authority, continuity records, one-human-one-seat, session-bound proofs |
| **Feedback** | 13 dated developer entries + the full preferred-feedback headings in [`world-testing.md`](../guides/world-testing.md) — including our blunt asks (expose a numeric sybil score; publish one complete Selfie Check example) |
| **Live** | https://mass.aonishchenko33.workers.dev |
| **Verify it yourself** | Open `src/world/verify.ts`, or `GET /api/verify/log` on the deployed URL |

*Technical brief: [`WORLD-TASK.md`](../tasks/WORLD-TASK.md) · Setup: [`WORLD-SETUP.md`](../guides/WORLD-SETUP.md)*
