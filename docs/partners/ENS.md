<p align="center">
  <img src="../../assets/mass-hero.png" alt="MASS — Collectively build your new AI colleague" width="760">
</p>

<h1 align="center">MASS × ENS</h1>
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

An AI agent that a team co-owns is a new kind of thing: a colleague, an asset, an
employee. And it has no identity. Today it is a row in someone's database and a
hex string on a chain — unfindable, unhireable, unverifiable, and gone the moment
its creators' startup shuts down.

Worse, the humans behind it have the same problem. "Alice contributed 40%" is
meaningless if Alice is `0x71C7…9f3A`. **Attribution without identity is just
bookkeeping.**

## The solution

MASS gives every participant *and* the agent a name, and makes the name the front
door to the record:

- Every verified crew member gets an ENS subname the moment they claim a seat.
- The agent gets a name that resolves to its **entire employment record** —
  skills, who taught it what, its owners and their shares, its brain's hash, its
  availability and rate.
- The agent's answers cite teachers **by their `.eth` name**, not by an id.
- **There is not a single hex address anywhere in the product.**

> **The line we lead with:** *"MASS turns ENS names into careers."*

---

## How people use it

| # | What the user does | What ENS does |
|---|---|---|
| 1 | Joins a session and verifies as a human | They immediately become `alice.mass.eth` — shown everywhere, no address ever |
| 2 | Teaches the agent something worth keeping | Their name is bound to that knowledge chunk |
| 3 | Asks the agent a question | The answer reads *"(per `alice.mass.eth`'s contribution #7)"* |
| 4 | Closes the session — **the Birth** | The agent's name resolves to its full CV |
| 5 | Sends the agent's name to anyone | They open `/cv/docs.mass.eth` and see a live employment record — no wallet, no login |
| 6 | An outsider wants to hire it | The name carries availability + rate card |

The name is the only thing a person has to remember, and it outlives the
hackathon, the session, and us.

---

## What we use from ENS

| ENS feature | Where it runs in MASS |
|---|---|
| **Subnames** (Durin / L2 issuance) | One per verified seat: `alice.mass.eth`, minted on claim |
| **Primary (reverse) names** | Set for crew, the agent, and the treasury — so nothing renders as hex |
| **Text records (ENSIP-5)** | The agent's employment record: role, skills, owners + shares, brain root, audit topic, availability |
| **Forward + reverse resolution** | Cross-checked before we trust a record; the UI shows a ✓ verified / ⚠ unverified state |
| **`url` / `contenthash`** | Points at the public CV page, making the name the front door to the asset |
| **Avatar (ENSIP-12)** | Human faces in the crew list instead of identifiers |
| **CCIP-Read** | Live resolution for anyone, from a fresh browser, with no MASS session |

---

## ENS features, put in practice in order to…

- **…turn an AI agent into a hireable colleague with a permanent identity.**
  `docs.mass.eth` resolves to what it can do, who taught it, who owns it, and
  whether it is for hire. That record is portable and survives us.
- **…make attribution human.** "Per `alice.mass.eth`'s contribution #7" is a
  sentence a person can act on. `0x71C7…9f3A` is not. The citation, the cap-table
  row, and the ENS record are the *same identity*, end to end.
- **…delete hex from an entire product.** Crew, agent, treasury, payments,
  citations, cap table — all names. Our CI runs a `grep-hex` check that fails the
  build if an address literal appears in the UI.
- **…aggregate four ecosystems behind one link.** The agent's ENS record carries
  its World attestations, its 0G brain root, and its Hedera audit topic and
  cap-table token. One name, and a judge can pull the whole thread.
- **…make the record trustworthy, not just pretty.** Forward and reverse must
  agree before we show a name as verified.

---

## Why ENS is load-bearing here

Strip ENS out and MASS still *works* — and becomes unusable. The crew list turns
into hex, citations become opaque ids, the cap table becomes a spreadsheet of
addresses, and the agent has no findable identity, no CV, and no way to be hired.
ENS is the difference between a provable system and a *legible* one.

---

## Status

| | |
|---|---|
| **Built** | Seat subnames + unique-label derivation, agent employment record assembled from live session state, public CV page rendered from resolution, citations by name, forward/reverse verification, zero-hex enforced in CI |
| **Next** | Deploying a Durin L2 registry so subnames are minted on-chain rather than derived, and writing the agent's text records to the resolver at the Birth |
| **Live** | https://mass.aonishchenko33.workers.dev · CV page at `/cv/<name>` |
| **Verify it yourself** | `node scripts/grep-hex.mjs` (zero-hex), `GET /api/ens/cv` (the live record) |

*Technical brief: [`ENS-TASK.md`](../ENS-TASK.md)*
