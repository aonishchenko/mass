# ENS-MANUAL

## How our agent's name works, in plain English

This explains what ENS does in MASS, why the product stops working without it,
and exactly how to operate it. No prior ENS knowledge assumed.

---

## 1. The one-sentence version

**Our agent's ENS name is its address. Not a label on top of an address — the
address itself.** Take the name away and nobody can find or hire the agent.

---

## 2. What ENS actually is

ENS is the naming system for Ethereum. `alice.eth` instead of
`0x71C7…9f3A`. Think of it like DNS for the web: `google.com` is easier to
remember than an IP address, and the domain can also carry *records* — extra
information attached to the name.

Two words you need:

| Word | Means |
|---|---|
| **Name** | `mass-lisbon.eth` — the thing you own |
| **Subname** | `alice.mass-lisbon.eth` — a name *underneath* one you own. You can create as many as you like, free |
| **Text record** | A small labelled note attached to a name. Like a DNS TXT record: `description = "a documentation reviewer"` |

**You can only create subnames under a name you own.** This matters — see §7.

---

## 3. What we use it for

### a) Everyone gets a name

When you join a session and verify you're a real human, you get a subname:

```
Niek  →  niek.mass-lisbon.eth
```

That name is used everywhere: the crew list, the ownership table, and — the
important one — **the agent's citations**:

> "Documentation should show the credential shape *(per `niek.mass-lisbon.eth`'s
> contribution #3)*"

Ownership is attributed to a **name**, not to a random internal ID. A person can
be pointed at.

### b) The agent gets a name, and that name is how you reach it

This is the part that makes ENS essential rather than cosmetic.

The agent's name carries records that say **where the agent lives**:

```
agent-context         "Doc — a documentation reviewer. Taught 4 things by
                       3 verified humans. Owned by niek… 60%, oleksiy… 40%.
                       Cites its teachers. Paid in HBAR."
agent-endpoint[web]   https://…/cv/doc.mass-lisbon.eth?session=…
agent-endpoint[a2a]   https://…/api/agent/doc.mass-lisbon.eth?session=…
```

Only endpoints that actually answer are published. An MCP endpoint was listed
here before an MCP server existed; a record pointing at a 404 is the same kind
of unbacked claim as a proof we issued ourselves. Add the record when the
server exists, not before.

This follows **ENSIP-26**, the ENS standard for finding AI agents. Anyone who
wants to hire our agent does this:

1. Look up the name
2. Read `agent-context` to see what it does
3. Read `agent-endpoint[…]` to get the address
4. Connect

**We do not publish our server's URL anywhere else.** The name is the only route
in. That's the design decision that makes ENS load-bearing: remove the record and
the agent is unreachable — no jobs, no earnings, nothing to pay the people who
taught it.

### c) The agent's CV lives at its name

`/cv/doc.mass-lisbon.eth` is a public page: what it knows, who taught each
thing, who owns what percentage, where its memory is stored, and its audit log.
No login. That's the link you send to a judge or a customer.

---

## 4. The two other standards, in plain words

### ENSIP-25 — proving the name and the registry entry are the same thing

There's a public register of AI agents called **ERC-8004** — think Companies
House for agents. You register, and your agent gets an entry with a number.

ENSIP-25 is the **two-way handshake** proving the register entry and the ENS
name belong together. It's exactly like proving you own a website by adding a
code Google gives you:

- The register entry says "I am `doc.mass-lisbon.eth`"
- The name owner adds a record saying "yes, that's me"

Only when **both** are true is the link real. The record looks like:

```
agent-registration[0x0001…8004a169…][42]  =  "1"
```

That long middle part is the register's address in a compressed format called
ERC-7930. We compute it in `src/ens/erc7930.ts`, and there's a test proving our
output matches the example published in the ENSIP-25 spec exactly.

### ENSIP-27 — the agent's business card

Once someone follows `agent-endpoint[…]`, what do they get? ENSIP-27 defines
that: a JSON file at `/.well-known/agent.json` with the agent's name, skills,
capabilities, and — importantly — its ERC-8004 registry anchor.

**The full chain:** name → context → endpoint → business card → on-chain entry.
Every link checkable by a stranger.

---

## 5. The honesty rules we enforce in code

These exist because we broke them once and it shipped.

1. **Never display a name we don't own.** There is no default parent name. If
   `ENS_PARENT_NAME` is blank, the agent has *no* public identity and the UI
   says so. It does not invent one.
2. **Never link to a registry entry that doesn't exist.** The ENSIP-25 record is
   only published when a real registration is configured.
3. **Never claim a trust model we can't back.** The agent card only lists
   `tee-attestation` when sealed runs genuinely produce attestations.

---

## 6. Operating it

### Settings

| Setting | What it is | Example |
|---|---|---|
| `ENS_PARENT_NAME` | **A name you own.** Blank = no identity | `mass-lisbon.eth` |
| `ENS_L1_RPC` | Where to look names up | an Alchemy/Infura Sepolia URL |
| `ENS_CHAIN` | Which network the name is on | `sepolia` |
| `ENS_AGENT_LABEL` | Default label if a crew doesn't name their agent | `doc` |
| `ERC8004_REGISTRY` | The agent register's address | `0x…` |
| `ERC8004_CHAIN_ID` | Which network that register is on | `84532` (Base Sepolia) |
| `ERC8004_AGENT_ID` | Our agent's number in it | `42` |

Locally these go in `.dev.vars`. In production: `wrangler secret put` for
secrets, `wrangler.jsonc` for the public ones.

### Checking it works

```bash
# Does the deployment know its own name?
curl "https://<host>/api/ens/cv?session=<room>" | jq '.profile.name, .resolved'

# The records we publish (the ENSIP-26 endpoints live here)
curl "https://<host>/api/ens/cv?session=<room>" | jq '.records'

# The agent's business card (ENSIP-27)
curl "https://<host>/.well-known/agent.json" | jq
```

**What good looks like:** `.profile.name` is a name you own, `.resolved.verified`
is `true`, and `.records` contains `agent-endpoint[a2a]`.

**What broken looks like:** `.profile.name` is `null` (no name configured), or
`.resolved.error` says "ENS not configured" (no RPC).

### Common problems

| Symptom | Cause | Fix |
|---|---|---|
| Agent has no name in the UI | `ENS_PARENT_NAME` blank | Register a name, set it |
| Name shows but "⚠ unverified" | No `ENS_L1_RPC`, or the name has no address set | Add an RPC; set the address record on the name |
| Names appear but resolve to nothing | Subnames were never issued on the registry | See `ENS-BASE-SEPOLIA-GUIDE.md` |
| No `agent-registration[…]` record | ERC-8004 vars not set | Register the agent, fill the three vars |

---

## 7. The mistake we already made — don't repeat it

The code used to fall back to a hardcoded parent name, `mass.eth`, when nothing
was configured. That shipped. Which meant production displayed names like
`alice.mass.eth`.

**`mass.eth` is a real name on Ethereum mainnet, owned by a stranger**
(`0xaEA52844eFbc805918cfF86Ed10cCE0481D20deC`). We were showing subnames of
someone else's domain — names that could never be issued, because only that
owner can issue them.

The fallback is now deleted. If you're tempted to add a placeholder name so the
UI "looks complete", don't. An empty state is honest; a borrowed name is not.

---

## 8. Glossary

| Term | Plain meaning |
|---|---|
| **ENS** | Naming system for Ethereum. DNS, roughly |
| **Name / subname** | `mass-lisbon.eth` / `alice.mass-lisbon.eth` |
| **Text record** | A labelled note attached to a name |
| **Resolve** | Look up a name and read its records |
| **Primary (reverse) name** | The name shown *for* an address — so apps display `alice.eth`, not `0x71C7…` |
| **L1 / L2** | Ethereum mainnet / a cheaper network built on top (we use Base) |
| **Sepolia** | Ethereum's free test network |
| **Base Sepolia** | Base's free test network |
| **ERC-8004** | Public register of AI agents |
| **ENSIP-25** | Proof that a name and a register entry are the same agent |
| **ENSIP-26** | How to find an agent through its ENS records |
| **ENSIP-27** | The agent's business-card JSON |
| **ERC-7930** | Compressed way of writing "this address on this chain" |
| **CCIP-Read** | How a mainnet name can fetch its answer from an L2 or a server |
| **Durin** | Tooling for issuing ENS subnames on an L2 |

---

*Setup: `ENS-BASE-SEPOLIA-GUIDE.md`. What we're aiming at: `docs/ENS-TASK.md`.*
