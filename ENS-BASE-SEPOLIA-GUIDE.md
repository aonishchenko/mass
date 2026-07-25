# ENS on Base Sepolia — step-by-step setup

**Audience: Oleksiy (or whoever wires this up). Everything here is free testnet.
Target: ~90 minutes for steps 1–5, which is the part that matters.**

Companion to [`ENS-MANUAL.md`](./ENS-MANUAL.md), which explains *why*. This is
the *how*.

---

## What you're building

```
        SEPOLIA (L1)                      BASE SEPOLIA (L2)
  ┌──────────────────────┐          ┌────────────────────────┐
  │  mass-lisbon.eth     │          │  L2 Registry           │
  │  (a name we own)     │◄────────►│  niek.mass-lisbon.eth  │
  │                      │ CCIP-Read│  doc.mass-lisbon.eth   │
  │  L1 Resolver ────────┼──────────┤  + their text records  │
  └──────────────────────┘          └────────────────────────┘
```

A name on Sepolia that we own, whose subnames actually live on Base Sepolia
(cheap/free), connected by a resolver that knows to go and ask the L2. That's
what **Durin** sets up for you.

**Why testnet:** free, fast, and judges care that it *resolves*, not which
network it's on. If we later want mainnet, the same steps apply with real names.

---

## Before you start

- A browser wallet (MetaMask/Rabby) with a **throwaway** account. Never a wallet
  holding real funds.
- ~10 minutes of faucet-wrangling.

---

## Step 1 — Get testnet ETH (10 min)

You need funds on **two** networks:

| Network | Why | Faucet |
|---|---|---|
| **Sepolia** | To register the name | <https://sepoliafaucet.com> or Alchemy's faucet |
| **Base Sepolia** | To deploy the registry + mint subnames | <https://www.alchemy.com/faucets/base-sepolia> or bridge from Sepolia |

Add both networks to your wallet (chainlist.org has one-click entries).
Base Sepolia chain id is **84532**; Sepolia is **11155111**.

✅ **Done when:** you can see a non-zero balance on both.

---

## Step 2 — Register the name on Sepolia (10 min)

1. Go to **<https://sepolia.app.ens.domains>**
2. Connect your wallet (make sure it's on **Sepolia**)
3. Search for a name — suggestion: **`mass-lisbon.eth`**, or `mass-agents.eth`
4. Register it. Two transactions, a short wait between them.

⚠️ **Pick something we clearly own and that isn't taken.** Do **not** reuse
`mass.eth` — that's a real mainnet name owned by a stranger, and it is exactly
the bug this whole guide exists to fix.

✅ **Done when:** the name shows in your wallet on `sepolia.app.ens.domains`.

---

## Step 3 — Deploy the L2 registry with Durin (20 min)

Durin is ENS's opinionated toolkit for issuing subnames on an L2.

1. Go to **<https://durin.dev>**
2. Follow their flow, choosing **Base Sepolia** as your L2
3. It walks you through:
   - **Deploy the L2 Registry** — the contract that owns the subnames (they're
     ERC-721 NFTs, and they hold text records)
   - **Configure the L1 Resolver** — points `mass-lisbon.eth` at that registry,
     so mainnet/Sepolia lookups fetch from Base Sepolia via CCIP-Read
   - **Customise the Registrar** — the contract that controls *who* may mint
   - **Connect registrar to registry** — one `addRegistrar()` call
   - **Mint your first subname** — do it, as a smoke test

**Write down the L2 Registry address.** That's `ENS_DURIN_REGISTRY`.

✅ **Done when:** you minted `test.mass-lisbon.eth` on Durin and it appears.

---

## Step 4 — Prove it resolves (5 min) ← the most important step

Do not skip this. If it doesn't resolve for a stranger, it doesn't count.

```bash
# From anywhere, with no wallet connected:
curl "https://sepolia.app.ens.domains/test.mass-lisbon.eth"
```

Better: open **<https://sepolia.app.ens.domains/test.mass-lisbon.eth>** in a
**private/incognito window**. If the subname loads with its records, CCIP-Read
is working end to end.

✅ **Done when:** a logged-out browser sees the subname.

❌ **If it doesn't:** the L1 Resolver step didn't take. Re-run step 3's
"Configure L1 Resolver" and check it points at your L2 registry address.

---

## Step 5 — Point MASS at it (10 min)

In `wrangler.jsonc`:

```jsonc
"ENS_PARENT_NAME": "mass-lisbon.eth",
"ENS_CHAIN": "sepolia",
"ENS_AGENT_LABEL": "doc",
```

As secrets:

```bash
wrangler secret put ENS_L1_RPC          # a Sepolia RPC (Alchemy/Infura free tier)
wrangler secret put ENS_DURIN_REGISTRY  # the L2 Registry address from step 3
wrangler secret put ENS_REGISTRAR_KEY   # throwaway key that may mint subnames
```

Then verify:

```bash
curl "https://<host>/api/ens/cv?session=demo" | jq '.profile.name, .resolved.verified'
```

✅ **Done when:** you get a name under `mass-lisbon.eth` and `verified: true`.

---

## Step 6 — Register the agent in ERC-8004 (30 min, optional but high value)

This is what unlocks ENSIP-25.

1. Find the **ERC-8004 Identity Registry** address on Base Sepolia
   (**ask the ENS booth — this is question #1 on our list**; the spec's mainnet
   example is `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`)
2. Call `register(agentURI)` where `agentURI` is our agent card:
   `https://<host>/.well-known/agent.json`
3. Note the returned `agentId`
4. Set:

```bash
wrangler secret put ERC8004_REGISTRY   # the registry address
wrangler secret put ERC8004_AGENT_ID   # the id you got back
# ERC8004_CHAIN_ID is already 84532 in wrangler.jsonc
```

MASS then automatically publishes the ENSIP-25 record. You can see the exact key
it will write:

```bash
curl "https://<host>/api/ens/cv?session=demo" | jq '.records | keys'
# look for: agent-registration[0x0001…][<id>]
```

5. **Write that record onto the agent's subname** (via the Durin/ENS UI, or the
   registry's setText). Value: `1`

✅ **Done when:** resolving the agent's name returns an `agent-registration[…]`
record, and the registry entry points back at the same name. The link is now
verifiable in both directions — which is the whole point of ENSIP-25.

---

## Step 7 — The demo beat (5 min to rehearse)

Once steps 1–5 are done, this is the thing to show a judge:

1. Show a stranger hiring the agent: they resolve `doc.mass-lisbon.eth`, read
   `agent-endpoint[a2a]`, and connect.
2. **Delete the `agent-endpoint[a2a]` text record.**
3. Try again — **the agent is unreachable.** Not degraded. Gone.
4. Put the record back. It returns.

> "There is no other address. Our agent exists on the network exactly as much as
> its ENS name says it does."

---

## Quick reference

| Thing | Value |
|---|---|
| Sepolia chain id | `11155111` |
| Base Sepolia chain id | `84532` |
| ENS Sepolia app | <https://sepolia.app.ens.domains> |
| Durin | <https://durin.dev> |
| Base Sepolia faucet | <https://www.alchemy.com/faucets/base-sepolia> |
| Base Sepolia explorer | <https://sepolia.basescan.org> |

## If you get stuck

| Problem | Likely cause |
|---|---|
| Registration tx fails on Sepolia | Out of Sepolia ETH, or the name is taken |
| Durin deploy fails | Wrong network in wallet — must be Base Sepolia |
| Subname mints but doesn't resolve | L1 Resolver not configured (step 3b) |
| Resolves for you, not incognito | You're seeing cached wallet state, not real resolution — treat as broken |
| MASS shows no name | `ENS_PARENT_NAME` not set, or deploy didn't pick up the secret |

**Rule of thumb:** if a logged-out incognito window can't see it, it isn't real
yet.
