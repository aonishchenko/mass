# MASS — Multiplayer Agent Session System
## Spec v0.7 — GIT-NATIVE EDITION
**NOW: Sat 25 Jul, afternoon. Demo Sunday 09:00 WEST. TWO booth pitches Sunday AM: ENS + Hedera (in person).**
**EXECUTION: follow TASKBOARD.md (hour-by-hour run plan + role split). This file is reference only from here on.**
**This file is the single source of truth. Companion files: TASKBOARD.md (hour-by-hour run plan + roles), AGENT-ANATOMY.md (what an agent is made of), SUBPROJECT-PROOF-OF-TEACHING.md v3 (ownership + royalties, decisions locked), EMPLOYMENT-LAYER.md (taking work from OKX AI / Virtuals ACP), BUILD-PATH.md (the guided flow that completes an agent), LISTING-ON-VIRTUALS-ACP.md (putting the agent to work), MARKETPLACE-EARNINGS.md (reading its earnings), PITCH.md (4-min pitch + Q&A bank), world-testing-template.md (World deliverable), SUBMISSION-PACK.md (README/demo/booth/checklists).**

---

# PART A — WHAT WE ARE BUILDING (read once together, 10 min)

## A1. Positioning
**Build your next team member. Together. On the record.**
A crew of verified humans collectively builds an AI team member: its brain grows
from accepted contributions, every contribution is attributed on an immutable
log, and ownership follows that log through a native royalty mechanism.
Category: asset-builder ("raise an agent with a cap table"), NOT a shared
workspace.

## A2. The three exact novelty claims (say these, ONLY these)
1. **Sybil-proof contribution equity** — cap-table shares backed by World-verified
   unique humans; the HCS log is the evidence behind the cap table.
2. **Live quorum authority** — the agent's permissions are recomputed in real
   time from the verified humans present.
3. **A brain that cites its teachers** — the agent attributes its answers to
   the specific human contributions it draws on.
Everything else (delegation, mandates, audit trails, iNFT minting) is
"and of course it also has" — never claimed as novel (AIverse, Argus,
Foundry, commodity audit infra own that ground; see SUBMISSION-PACK prior-art).

## A3. The honesty rules (recite before any judge conversation)
1. The "brain" = curated encrypted memory + instructions + skills on 0G
   Storage. NOT weight training. Roadmap line: "0G fine-tuning is live; that
   is the natural next step for this same asset."
2. The crew token = "contribution receipt with a royalty fee schedule."
   Never "revenue share." Never securities language.
3. Say "TEE attestation of sealed execution." Never "ZK-proven."

## A4. Authority model (hardcoded v1)
| Tier | Gate | Unlocks |
|---|---|---|
| T1 Observer | invite link | watch + read log |
| T2 Builder | World Selfie Check (+ sybil score recorded) | instruct agent (DRAFT lane) |
| T3 Signer | Orb-verified via AgentKit | accept contributions, COMMIT actions |
- DRAFT: >=1 T2 present. COMMIT / MERGE: **2 distinct verified signatures, the author may be one of them** (so at least one other human signs). Crew change → recompute perms.
- Selfie continuity: re-verify on each accepted contribution.
- HARD RULE: every World proof is VERIFIED SERVER-SIDE (on-chain or cloud API).
  World judges check this at the pitch. Rendering the widget is NOT enough.

## A5. Zero-hex doctrine (ENS)
The judge test is: "do I ever see a hex address in this demo?" Answer must be
NO. Primary (reverse) names for every participant AND the agent AND the named
session treasury account. Anywhere the app reads or writes an address, it
shows a name. Grep check before freeze.

## A6. The demo arc (full script in SUBMISSION-PACK.md)
Verified seats claimed (names, sybil badge) → co-steering + redirect →
contribution accepted via 2-of-M co-sign → SEALED processing w/ proof chip +
immune-system verdict → agent ANSWERS CITING ITS TEACHERS → THE BIRTH
(cap-table mint per log, Agentic ID + delegations, ENS CV resolves) →
THE FIRST JOB (outsider pays; split hits crew wallets live).

## A7. THE AGENT IS A REPOSITORY (git-native model — v0.7)
We do not compete with git; we stand on it. An agent is physically a folder of
text: values, knowledge, skills, mandates. Putting it in a real repository gives
us authorship, history, review, forking and rollback for free. We add the four
things git lacks: **proof the author is a unique human** (World), **an immutable
anchor so history cannot be quietly rewritten** (Hedera), **a private, ownable,
transferable snapshot** (0G), and **a resolvable public identity** (ENS).

Flow, one motion: chat → "Propose to brain" → the agent drafts a concrete
before/after → 2 verified signatures → merge → hash anchored, snapshot sealed,
brain reindexed → the agent cites the lines it uses → payment follows those lines.

Ownership vocabulary (use these words, never "blame"):
- **Authorship** — who wrote the parts of the agent still in it today.
- **Usage** — how much the agent actually leans on those parts in paid work.
- **Authorship Map** — the UI name for the combined ownership view.
- `equity = 0.30 × Authorship + 0.70 × Usage`

Locked decisions D1–D12 live in SUBPROJECT-PROOF-OF-TEACHING.md §2. Weekend
scope: ONE agent, a **Technical Documentation Writer**, full loop end to end.
Chosen on evidence: code review and technical documentation are the named
demand categories on the ACP marketplace, where 2 sellers currently serve 3,700
buyers. Documentation quality is almost entirely tacit knowledge that lives in
two or three people's heads and leaves when they do, which is exactly what MASS
captures and pays for.


---

# PART B — FEATURE REGISTER v0.6

## B1. MUST HAVE (all committed; none negotiable)
| # | Feature | Module | Cost |
|---|---|---|---|
| 1 | Server-side World proof verification (DoD gate) | M3 | ~1h |
| 2 | Hedera tooling adoption: skills plugin + Docs MCP tonight; scaffold-har x402 template as payForInference base; validate-submission at freeze | M4/M8 | SAVES time |
| 3 | Durin (durin.dev) for seat subnames | M5 | SAVES time |
| 4 | Zero-hex doctrine: primary names for crew + agent + treasury | M5/M1 | ~1-2h |
| 5 | Agent cites its teachers (chunk metadata + prompt discipline) | M6/M2/M1 | ~2h |
| 6 | Prior-art section + 3-claim novelty discipline | M8 | ~30m |
| 7 | Admin bundle: Finalist-judging opt-in, DEPLOYED public URL (World: 10% of rubric), clean commit history, dual Sunday booth pitches | M8 | ~1h |

## B2. NICE TO HAVE (take strictly in this order as time allows)
| # | Feature | Module | Cost |
|---|---|---|---|
| 1 | The First Job: outsider pays agent, split to crew per cap table, live | M7/M4 | ~2h |
| 2 | Brain immune system: sealed screening of each proposed contribution, verdict logged | M6/M4 | ~2-3h |
| 3 | Sybil-score badge on seats + logged | M3/M1 | ~1h |
| 4 | Agent public CV page (ENS-resolved employee record) | M1/M5 | ~2h |
| 5 | Selfie continuity ping on each acceptance | M3 | ~1h |
| 6 | Challenge state in contribution lifecycle (propose→challenge→accept) | M0/M1 | ~1-2h |

## B3. NICE TO HAVE BUT TAKES SOME TIME (start ONLY if B1 done and B2 items 1-3 green by Sat evening; half-finished = worse than none)
| # | Feature | Module | Cost | Why it still tempts us |
|---|---|---|---|---|
| 1 | Identity Check regulated-session toggle (one COMMIT action gated by 18+/jurisdiction attestation) + necessity/data-minimization note | M3 | ~2h ON TOP of IDKit work — MODERATE EXTRA TIME | Stackable second World beta track; feedback = 25% of rubric; our testing-doc discipline is the edge |
| 2 | ERC-8004 registration + ENSIP-25 verification loop | M4+M5 | 3-5h — SIGNIFICANTLY INCREASES DEV TIME (new integration surface: registry contract + verification flow) | One integration, extra points at BOTH Hedera and ENS; explicitly flagged "new and interesting" by ENS |

## B4. Cut order under pressure (apply without discussion)
B3.2 → B3.1 → B2.6 → B2.5 → B2.4 → B2.3 → B2.2 → B2.1 (fight for B2.1/B2.2).
NEVER cut anything in B1. NEVER cut: honest inference path, Selfie gate +
server verification, HCS log, contribution-weighted mint, >=1 Hedera payment,
live ENS resolution, deployed URL.

---

# PART C — INTERFACE CONTRACTS (frozen; changing = both agree)

## C1. Event schema (the spine)
```ts
type Tier = "T1" | "T2" | "T3";
type EventType =
  | "session.created" | "seat.claimed" | "seat.left"
  | "verify.selfie.ok"        // payload: {sybilScore}
  | "verify.agentkit.ok" | "verify.continuity.ok"
  | "verify.identity.ok"      // B3.1 only: {attribute:"over18"|jurisdiction}
  | "perm.recomputed"
  | "instruct" | "handoff"
  | "draft.started" | "draft.completed"
  | "contrib.proposed" | "contrib.challenged" | "contrib.cosigned"
  | "contrib.screened"        // B2.2: {verdict:"pass"|"flagged", attestationRef}
  | "contrib.accepted"
  | "canonical.started" | "canonical.completed"   // {attestationRef}
  | "payment.executed"        // {hederaTxId, kind:"inference"|"job"|"split"}
  | "brain.updated"           // {storageRootHash}
  | "session.closed" | "captable.minted" | "agent.minted"
  | "job.received" | "job.paidout";               // B2.1

interface MassEvent {
  id: string; ts: number; type: EventType;
  actor: { seat: string; tier: Tier } | { system: true } | { agent: true };
  payloadHash: string;      // sha256; HCS gets ONLY {id,ts,type,actorTier,payloadHash}
  payload?: unknown;        // in-memory + encrypted 0G only, NEVER to HCS
  refs?: { hederaTxId?: string; hcsSeq?: number; attestationRef?: string;
           storageRootHash?: string; ensName?: string };
}
```
Cap table = count of `contrib.accepted` per seat. Nothing else.

## C2. Brain chunk format (enables citing — MUST #5)
```ts
interface BrainChunk {
  chunkId: string;                 // = contrib event id
  contributor: string;             // ENS seat name
  contribNumber: number;           // per-contributor counter → "Alice #7"
  content: string;                 // the accepted knowledge/instruction
  screened: boolean;               // immune-system verdict (B2.2)
  attestationRef?: string;
}
// Canonical-lane system prompt MUST include:
// "When your answer draws on a brain chunk, cite it inline as
//  (per <contributor>'s contribution #<n>). Never invent citations."
```

## C3. Provider adapter
```ts
interface InferenceProvider {
  name: "groq" | "openrouter" | "0g-pc";   // all OpenAI-compatible; 3 base URLs
  chat(req: {messages: Msg[]; stream: true}): AsyncIterable<Token>;
  sealed: boolean;
  getAttestation?(responseId: string): Promise<AttestationRef | null>;
}
// lane="draft" → fastest non-sealed; lane="canonical" → sealed or throws
// SealedUnavailable → UI honesty banner (exact copy in SUBMISSION-PACK).
```

## C4. Worker interfaces (each ships src/<module>/mock.ts: deterministic, 300ms, logged)
```ts
// M3 World  (ALL verifications hit the server-side verify API — hard gate)
verifySelfie(seat): Promise<{ok, attestationHash, sybilScore}>
verifyAgentKit(seat): Promise<{ok, proofRef}>
verifyIdentity(seat, attr): Promise<{ok}>            // B3.1
// M4 Hedera (base: scaffold-har x402 + payments templates)
logEvent(e): Promise<{hcsSeq, txId}>
payForInference(requestHash): Promise<{txId}>
receiveJobPayment(): Promise<{txId, amount}>          // B2.1
payoutSplit(alloc): Promise<{txIds}>                  // B2.1
scheduleExpiry(at): Promise<{scheduleId}>             // build-only
mintCapTable(alloc): Promise<{tokenId}>               // w/ royalty fee schedule
announceHcs14(agentMeta): Promise<void>
registerErc8004(agentMeta): Promise<{registryRef}>    // B3.2
// M5 ENS (base: Durin)
claimSeat(member, session): Promise<{ensName}>        // + set PRIMARY name
writeAgentProfile(records): Promise<void>             // ENSIP-26 + brainRoot + hcsTopic
nameTreasury(account): Promise<{ensName}>
resolve(name): Promise<Record<string,string>>
verifyEnsip25(agentName): Promise<{verified}>         // B3.2
// M6 0G
sealedInfer = InferenceProvider("0g-pc")
screenContribution(chunk): Promise<{verdict, attestationRef}>   // B2.2
writeBrain(chunks: BrainChunk[]): Promise<{rootHash}>  // log storage, 1st-party encryption, pinned SDK
mintAgenticId(meta): Promise<{tokenId, explorerUrl}>
delegateUser(tokenId, address): Promise<void>
```

---

# PART D — MODULE CARDS (execution detail in TASKBOARD.md)

### M0 CORE (pair, tonight ~90m) — blocks all
Repo, types (C1-C4), WS event bus, in-memory session state, authority engine
as pure `computePerms(crew)` w/ 5 unit tests (incl. last-T3-leaves →
complete-then-lock; challenge state transition).
DoD: two browser tabs share one mocked event stream; tests green.

### M1 UI COCKPIT (T shell, N copy) — needs M0
Stream pane, log ticker (renders ONLY from MassEvents), seat badges
(tier + sybil badge B2.3), proof chip, citation highlighting in agent output
(MUST #5), cap-table preview, honesty banner, CV page (B2.4: one read-only
route resolving agent ENS name → skills index, who-taught-what, attestations,
availability, cap table — zero hex anywhere).
DoD (mocks): full arc clickable start→Birth→First Job with fake data.

### M2 INFERENCE ROUTER (T) — needs M0
One adapter, three base URLs. Tonight: curl 0G PC (TG promo key), record
`[0G LATENCY: ____ tok/s | sealed models: ____]` here. Attestation fetch per
booth answer. Citation system-prompt wired into canonical lane (C2).
DoD: draft lane streams in UI; canonical lane returns attestationRef
(real or mock per latency outcome).

### M3 WORLD (N) — needs M0
Selfie on seat claim → SERVER-SIDE VERIFY (hard gate) → sybil score into
event + badge. AgentKit T3 delegation (booth: native multi-principal or
server-side aggregation). Continuity ping on acceptance (B2.5).
B3.1 stretch: one COMMIT action flips to "regulated" requiring
verifyIdentity(over18) + write the one-page necessity/minimization note.
EVERY friction → world-testing-template.md AS IT HAPPENS (dated).
DoD: two real humans reach T2 in-flow; proofs verified server-side
(code shown at pitch); testing doc >=10 dated entries.

### M4 HEDERA (T) — needs M0; real wire at MP2
Base from scaffold-har (x402 + payments-scheduler templates) + skills plugin
+ Docs MCP installed tonight. logEvent → HCS (hash-only) + Mirror Node
read-back drives ticker. payForInference per canonical run.
First Job (B2.1): receiveJobPayment + payoutSplit per cap table.
mintCapTable with royalty fee schedule. announceHcs14. scheduleExpiry
(build-only, HashScan link). B3.2 stretch: registerErc8004.
DoD: HashScan topic matches local ids; payment per canonical inference;
scripted-log mint allocates correctly; validate-submission run at freeze.

### M5 ENS (N) — needs M0 only
`[ENS NET: ____]` (booth). Parent name via ens-cli script. Seats via DURIN;
text records {role, tier, worldAttestationHash, sybilScoreBand, sessionId}.
PRIMARY names for crew + agent + nameTreasury (zero-hex doctrine, A5).
writeAgentProfile: ENSIP-26 + hcsTopicId + agenticId + brainRoot.
B3.2 stretch: verifyEnsip25 loop. Grep-for-hex check before freeze.
DoD: fresh wallet resolves seat + agent profile live; demo shows zero hex.

### M6 0G BRAIN + IDENTITY (T) — needs M2
Log storage uploader/downloader, first-party encryption, PINNED SDK versions
(old flow-contract tutorials are wrong). writeBrain(BrainChunk[]) on each
acceptance → rootHash → event → M5 record. screenContribution (B2.2) before
acceptance, verdict logged. mintAgenticId at close + delegateUser per T3.
DoD: brain round-trips; citations resolve to real chunks; Agentic ID on
explorer with >=2 delegated users.

### M7 THE BIRTH + FIRST JOB (pair, after MP2)
`closeSession()`: cap table from log → mint → Agentic ID + delegations →
final brain seal → ENS CV update → session.closed. Then availability flips
and First Job runs: outsider wallet pays, split lands, on screen.
DoD: full sequence runs clean twice in a row.

### M8 SUBMISSION MACHINE (N, continuous)
Everything in SUBMISSION-PACK.md: README (prior-art section, honesty notes,
architecture, payment flow, cap-table derivation), videos (0G <3:00,
Hedera <=5:00, master), World testing docs final, Finalist-judging OPT-IN on
the form, DEPLOYED URL (not localhost), prize-selection cap verified at
check-in, dual booth pitch scripts, validate-submission before freeze.
DoD: checklist 100%; N can run the entire demo alone.

---

# PART E — MERGE POINTS & TIMELINE
- **MP0 tonight:** M0 done; all module folders + mocks scaffolded; 0G latency
  recorded; Hedera tooling installed; ENS net + Durin confirmed.
- **MP1 Sat 13:00:** M1+M2+M3 wired — verified human instructs real streaming
  model, events flow. (= the safety floor: demoable no matter what.)
- **MP2 Sat 19:00:** M4+M5+M6 wired — HCS live, payments live, seats resolve,
  brain writes, citations render.
- **MP2.5 Sat ~20:30:** B2 items in order as green; B3 GO/NO-GO decision
  (rule: B1 done + B2.1-3 green = GO on B3.1; B3.2 only if genuinely ahead).
- **MP3 Sat ~22:30:** M7 runs twice → FREEZE → M8 finalization + rehearse.
- **Sun 08:00:** N → ENS booth prep; T → deployed-URL smoke test + demo
  machine. 09:00 presentation. Then ENS booth + Hedera booth pitches.

# PART F — REMAINING OPEN BLANKS (fill in as answered)
[0G LATENCY: ____] [0G attestation surface: ____] [sealed models: ____]
[ENS NET: ____] [AgentKit multi-principal: ____] [prize-selection cap: ____]
Honesty banner copy: "Unsealed mode — running on <provider>; no attestation
available for this response."

*v0.6 supersedes all prior versions. N = Niek, T = teammate.*
