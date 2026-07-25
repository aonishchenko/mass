# TASK: ENS integration for MASS — prize-track eligibility

## Context

MASS is a live multiplayer session where a crew of verified humans collectively
builds an AI agent. Contributions are merged into a git repo; ownership (a cap
table) is derived from who wrote the surviving lines and how often the agent
cites them. World makes each contributor a verified unique human; Hedera anchors
the log and settles payments; 0G holds the encrypted brain and the agent's
ERC-7857 identity.

**ENS is the identity and careers layer** — the part a human actually sees and
remembers. It turns every participant and the agent itself from a hex address
into a *name with a record*: the crew are named seats, and the agent is a named,
resolvable, co-owned **digital employee** whose ENS name resolves to its entire
employment record — skills, who taught it what, its owners, its attestations,
its brain hash, and whether it's for hire. The name is the one artifact that
outlives the hackathon.

Stack: TypeScript, Cloudflare Workers backend, React frontend, WebSocket event
bus, Durable Objects. Deployed at https://mass.aonishchenko33.workers.dev.
Sibling docs: `WORLD-SETUP.md`, `world-testing.md`, `MASS-specs.md` (A5 zero-hex
doctrine, M5 ENS module card), `AGENT.md`, `MARKETPLACE-EARNINGS.md`.

## Target track
1. **ENS — Best use of ENS ($5,000, single pool).**

## Judging criteria (build to these — ENS's published guidance)
- **It must be obvious how ENS improves the product, not an afterthought.** For
  us, ENS is load-bearing: without it there is no human-readable identity, no
  resolvable CV, and the demo shows raw hex.
- **Functional demo, NO hard-coded values.** Every name and record must resolve
  live from a real network. A grep for `0x…` in the UI must return nothing.
- **Creativity, functionality, technical difficulty, impact** (general rubric).
- **Video recording and/or live demo** on submission. ENS judges a booth in
  person on Sunday — the demo runs on the deployed URL, names resolving live.
- ENS's own cited exemplar: *"a wallet that mints an ENS subname on L2 and sets
  its primary name upon deployment."* We do exactly this per seat and for the
  agent, and then go far beyond it (a full employment record).

## Reference docs (read them — do NOT guess resolver/record APIs)
- Subnames overview (L1 / L2 / offchain): https://docs.ens.domains/web/subdomains
- Durin (opinionated L2 subnames): https://durin.dev — L2 Registry (ERC-721
  subnames + text records), L1 Resolver (CCIP-Read), L2 Registrar (`register()`).
- Resolving names & records (forward + reverse): https://docs.ens.domains/web/resolution
- Reverse / primary names: https://docs.ens.domains/web/reverse and L2 primary
  names (ENSIP-19).
- Text records (ENSIP-5), avatar (ENSIP-12), contenthash (ENSIP-7 / EIP-1577).
- Client libs: viem (`getEnsName`, `getEnsAvatar`, `getEnsText`,
  `getEnsResolver`) and/or `@ensdomains/ensjs`. Use the real signatures.
- ERC-8004 (agent identity registry) for the ENS↔registry consistency loop.
Do NOT hard-code an address→name map. Resolve everything.

---

## The one sentence to make an ENS judge lean in
> "In MASS there is not a single hex address anywhere in the demo — every human,
> the agent, and the treasury is a name — and the agent's name resolves to a
> complete, live employment record: its skills, the people who taught it, its
> owners, its attestations, and its brain's hash. ENS is how a co-built AI
> becomes a hireable colleague with a permanent identity."

---

## HARD REQUIREMENT 1 — Zero-hex doctrine (the judge's literal test)
The ENS judge test is *"do I ever see a hex address in this demo?"* The answer
must be **no**, everywhere, always.

Build:
- Every place the app renders an identity — crew list, citations, cap table,
  ticker/log, payment memos, the CV page, the treasury — shows a **name**, never
  a `0x…`. Reverse-resolve on read; if a name is missing, show a pending state,
  never the hex.
- A `scripts/grep-hex.mjs` check (and a note in the README) that greps the built
  UI output for `0x[a-fA-F0-9]{6,}` and fails if any appear. Run it before freeze.
- Primary (reverse) names are set for **crew seats, the agent, AND the Hedera
  treasury account** so even payments read as `treasury.<crew>.eth`.

Acceptance: a judge can watch the entire arc — join → teach → cite → Birth →
First Job — and never see a hex string. The grep check passes in CI.

## HARD REQUIREMENT 2 — Seat subnames on L2 via Durin (the exemplar, per seat)
Every crew member gets an ENS **subname** the moment they claim a verified seat.

Build:
- On `verify.selfie.ok` (seat becomes a Builder), mint/assign a subname under the
  session/crew parent, e.g. `alice.mass.eth`, via a Durin L2 registry (Base
  Sepolia for the demo). Set it as the seat's **primary name**.
- Write text records on the seat subname, sourced from what MASS already has —
  **no PII**:
  - `com.mass.tier` = Observer | Builder | Signer
  - `com.mass.world.nullifier` = the World nullifier hash from
    `src/world/verify.ts` (opaque, already non-PII)
  - `com.mass.sybilBand` = low | medium | high (band, never raw score → no
    fingerprinting)
  - `com.mass.session` = session id
  - `com.mass.contribCount` = accepted contributions (from the cap table fold)
  - `avatar` (ENSIP-12) = a generated identicon so the crew list is human.
- The subname resolves live for a fresh wallet/browser (CCIP-Read), not from
  local state.

Acceptance: a new seat appears in the crew list as `name.mass.eth` with a tier
badge, and its record resolves in the ENS manager / a block explorer, live.

## HARD REQUIREMENT 3 — The agent IS a resolvable employee (the wow moment)
The agent gets its own ENS name whose records are its **entire employment
record**, aggregating all four sponsors. This is the beat that wins the prize.

Build a `writeAgentProfile()` that, at the Birth (`session.closed` / cap-table
mint), sets the agent name (e.g. `docs.mass.eth`) and its text records:
- Standard: `name`, `description`, `avatar` (ENSIP-12), `url` (→ the CV page),
  `contenthash` (→ the CV page on IPFS, so the record is self-serving/decentralized).
- MASS profile (a documented text-record schema — see Data model):
  - `com.mass.role`, `com.mass.skills`
  - `com.mass.brainRoot` = the 0G Storage root hash of the sealed brain
  - `com.mass.hcs.topic` = the Hedera HCS topic id (the audit trail)
  - `com.mass.capTable.token` = the HTS cap-table token id
  - `com.mass.agenticId` = the ERC-7857 / ERC-8004 identity reference
  - `com.mass.owners` = the crew subnames + shares (or a pointer resolving to them)
  - `com.mass.availability` = `for-hire`, `com.mass.rateCard` (from `OPS/RATECARD.md`)
- Set the agent's **primary name** so it too is never shown as hex.

Acceptance: resolving `docs.mass.eth` (viem `getEnsText` / ENS manager) returns a
complete, live record. Nothing is hard-coded; every value traces to a real
artifact produced during the session.

## HARD REQUIREMENT 4 — The public CV page, resolved from the name
A read-only route (`/cv/:name`) that renders an agent's full "employee record"
by **resolving its ENS name** — no session required, works for anyone.

Build:
- Resolve the name → text records → render: role, skills, **who taught what**
  (each contributor by their `.eth` subname, linking to their share), the World
  attestations, the brain root hash (link to 0G), the HCS topic (link to
  HashScan), the cap table (owners by name), availability + rate card.
- Reachable via the agent name's `url` / `contenthash` record, so the ENS name
  is literally the front door to the asset.
- Zero hex on this page (Req 1 applies here hardest — it's the page judges read).

Acceptance: open `/cv/docs.mass.eth` in a fresh browser; the CV renders entirely
from ENS resolution, every identity a name.

## HARD REQUIREMENT 5 — The agent cites its teachers BY NAME
MASS's signature line — "per Alice's contribution #7" — must resolve to an ENS
name, closing the loop between attribution and identity.

Build:
- Citations render the contributor's ENS subname (`per alice.mass.eth's
  contribution #7`), linking to that seat's record and its cap-table share.
- `BrainChunk.contributor` is already the seat name in the codebase; bind it to
  the ENS subname so the citation, the cap table, and the ENS record are the
  same identity end to end.

Acceptance: in a canonical answer, a citation names a real `.eth` subname that
resolves to that contributor's seat record.

## HARD REQUIREMENT 6 — Forward↔reverse consistency (trust the record)
A record is only worth showing if it's authentic. Prove the name and the address
agree, both directions.

Build:
- On resolve, verify forward (name→address) and reverse (address→name) match
  before trusting a record; surface a ✓/⚠ "verified name" state in the UI.
- Where ERC-8004 is used for the agent's registry identity, cross-check the ENS
  name against the registry entry (the ENSIP-25-style verification loop in the
  MASS spec). If the two disagree, the UI says so rather than trusting either.

Acceptance: a mismatched/forged name shows an unverified state; the agent's own
name shows verified, live.

---

## UI requirements
- No hex addresses anywhere, ever (Req 1). Names or pending states only.
- Crew list: `name.mass.eth` + tier badge + avatar; reverse-resolved.
- A "verified name" ✓ affordance (Req 6); an ⚠ for unresolved/mismatched.
- The CV page is a first-class, shareable route rendered from ENS.
- Payment memos, cap table, and ticker all render names.
- Graceful pending states while resolution is in flight — never flash hex.

## Data model additions
```ts
// The MASS text-record schema (documented so a judge can reproduce it).
interface AgentEnsProfile {
  // standard ENS records
  name: string; description: string; avatar: string; url: string;
  contenthash: string;                    // CV page (IPFS)
  // com.mass.* profile
  role: string; skills: string[];
  brainRoot: string;                      // 0G storage root hash
  hcsTopic: string;                       // Hedera HCS topic id
  capTableToken: string;                  // HTS token id
  agenticId: string;                      // ERC-7857 / ERC-8004 ref
  owners: { name: string; shareBps: number }[];  // crew subnames + shares
  availability: "for-hire" | "unavailable";
  rateCard: string;                       // from OPS/RATECARD.md
}

interface SeatEnsRecord {
  name: string;                           // alice.mass.eth (primary name set)
  tier: "Observer" | "Builder" | "Signer";
  worldNullifier: string;                 // non-PII, from src/world/verify.ts
  sybilBand: "low" | "medium" | "high";   // band only, never the raw score
  session: string;
  contribCount: number;
}
```

## Worker interfaces (mirror the World module layout; ship `src/ens/mock.ts`)
```ts
// src/ens/*  — env-driven, with a mock for credential-free rehearsal.
claimSubname(seat, session): Promise<{ ensName: string }>   // Durin register() + set primary
writeSeatRecords(ensName, rec: SeatEnsRecord): Promise<void>
writeAgentProfile(ensName, profile: AgentEnsProfile): Promise<void>
nameTreasury(hederaAccount): Promise<{ ensName: string }>
resolve(name): Promise<Record<string, string>>              // text records, live
reverse(address): Promise<string | null>                    // primary name
verifyName(name): Promise<{ forward: boolean; reverse: boolean; erc8004?: boolean }>
```
Backend routes: `GET /api/ens/resolve?name=`, `GET /api/ens/cv?name=` (server-side
resolve for the CV route), mirroring `/api/verify/*`. Env: `ENS_PARENT_NAME`,
`ENS_L2_RPC`, `ENS_DURIN_REGISTRY`, `ENS_REGISTRAR_KEY` (secret), `ENS_CHAIN`,
`ENS_DEV_FALLBACK` (deterministic mock names, banner shown — never on in prod).

## Deliverable for the write-up (create `docs/ens-integration.md`)
A short doc the ENS reviewers read, answering explicitly:
- **How ENS improves the product** (why it's load-bearing, not decoration): the
  identity layer, the resolvable CV, the zero-hex demo.
- **Which ENS features are used**: L2 subnames (Durin), primary/reverse names,
  text records, avatar, contenthash, forward/reverse verification, (ERC-8004 loop).
- **No hard-coded values**: how every name/record resolves live; the grep-hex
  proof; a fresh-wallet resolution walkthrough.
- **The 60-second booth pitch** (aligns with `PITCH.md` §3): names → careers.
- Live links: parent name, one seat subname, the agent name, the CV page URL.

## DO NOT BUILD (these lose the prize or waste the weekend)
- **ENS as decoration.** No cosmetic name shown next to a hex address. If ENS can
  be removed and the product is unchanged, it's an afterthought — judges say so.
- **Hard-coded address→name maps or fake resolution.** Everything resolves live.
- **A custom naming system.** Use ENS resolution (CCIP-Read / Durin), don't
  reinvent it.
- **PII in text records.** Only bands, hashes, and opaque nullifiers — never a
  raw sybil score, a face, or a legal identity.
- **Blocking the session on L2 writes.** Name/record writes are queued off the
  critical path (same discipline as the 0G brain write), never gating a claim.

## Definition of done
1. Zero hex in the entire demo; `grep-hex` check passes (Req 1).
2. A verified seat mints a live L2 subname + primary name, with records that
   resolve for a fresh wallet (Req 2).
3. The agent's name resolves to a complete employment record aggregating World +
   Hedera + 0G artifacts (Req 3).
4. `/cv/:name` renders entirely from ENS resolution (Req 4).
5. A canonical answer cites a contributor by a resolving `.eth` subname (Req 5).
6. Forward/reverse (and ERC-8004 where used) consistency is checked and shown
   (Req 6).
7. Everything works on the deployed URL, live, on a real network — not localhost,
   not hard-coded.
8. `docs/ens-integration.md` written; booth pitch rehearsed; live links ready.

---

## Why this makes the ENS team proud (integration map)
Every hard requirement reuses something MASS already produces, so ENS binds the
whole product together instead of sitting beside it:

| ENS surface | MASS source (already built) |
|---|---|
| Seat subname + `world.nullifier` / `sybilBand` records | `src/world/verify.ts` (nullifier, sybil score → band) |
| `contribCount`, cap-table `owners` | the cap-table fold in `src/core/reduce.ts` |
| `com.mass.brainRoot` | the 0G sealed-brain root hash (`brain.updated`) |
| `com.mass.hcs.topic`, named treasury | Hedera anchoring + treasury (`src/hedera/*`) |
| `com.mass.agenticId` | the ERC-7857 Agentic ID at the Birth |
| Citations by `.eth` name | `BrainChunk.contributor` is already the seat name |
| Availability + rate card | `OPS/RATECARD.md`, `LISTING-ON-VIRTUALS-ACP.md` |

ENS is the human face of all of it: the crew's identities, the agent's career,
and the one link — a name — that a judge can open, read, and remember after the
hackathon ends.
