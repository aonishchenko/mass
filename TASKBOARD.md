# MASS TASKBOARD — tick boxes in order, per lane
**Rule: work only your lane between merge points. If blocked >20 min, switch to your next unblocked task, note the blocker here, move on.**
**N = Niek · T = teammate · P = pair. IDs reference MASS-specs.md v0.6.**

---

## TONIGHT (Fri) — target MP0 before sleep

### P — together first (~90 min)
- [ ] P1. Repo init, TypeScript, lint, `src/core` `src/ui` `src/infer` `src/world` `src/hedera` `src/ens` `src/zg` `docs/` `scripts/`
- [ ] P2. Paste C1–C4 types from spec into `src/core/types.ts` — compile clean
- [ ] P3. WS event bus + in-memory session state (M0)
- [ ] P4. `computePerms()` pure + 5 unit tests green (incl. challenge transition)
- [ ] P5. `mock.ts` in every module folder (deterministic, 300ms delay, console.log)
- [ ] P6. Two browser tabs show same mocked event stream → MP0 core done
- [ ] P7. Agree honesty-banner copy + demo task (mock NDA review checklist)

### T — after pairing
- [ ] T1. Join 0G Telegram, redeem promo testnet tokens, get DevRel handle
- [ ] T2. **KILL-OR-CONTINUE:** curl 0G PC (OpenAI-compatible) → write `[0G LATENCY]` + `[sealed models]` into spec Part F
- [ ] T3. Install Hedera skills plugin (`/plugin marketplace add hedera-dev hedera-skills`) + Hedera Docs MCP
- [ ] T4. `npx create scaffold-har` → pull x402 + payments-scheduler templates into `src/hedera/`
- [ ] T5. Hedera testnet account + faucet; create HCS topic; submit 1 test message; see it on Mirror Node

### N — after pairing
- [ ] N1. World dev portal: team, app ID, RP ID; confirm weekend Selfie/Identity full access
- [ ] N2. Create `docs/world-testing.md` from template file; first dated entry (portal setup friction counts!)
- [ ] N3. ENS: booth/Discord → write `[ENS NET]` into spec Part F; skim durin.dev quickstart
- [ ] N4. Register parent name via ens-cli → `scripts/ens-setup.sh`
- [ ] N5. Skeleton `SUBMISSION-PACK` items: repo README stub w/ prior-art section headings

---

## SATURDAY AM — target MP1 at 13:00

### T
- [ ] T6. M2: provider adapter, 3 base URLs; draft lane streams Groq into UI
- [ ] T7. M2: canonical lane → 0G sealed (or mock per T2 outcome); attestationRef plumbed
- [ ] T8. M2: citation system prompt (C2) wired into canonical lane
- [ ] T9. M1: cockpit shell — stream pane, ticker, seat badges, proof chip

### N
- [ ] N6. M3: Selfie Check on seat claim → **server-side verify call** (HARD GATE — code must be showable at pitch)
- [ ] N7. M3: sybil score captured into `verify.selfie.ok` payload
- [ ] N8. M3: AgentKit T3 flow per booth answer `[multi-principal: ____]`
- [ ] N9. Testing doc: keep logging every friction, dated
- [ ] N10. M5: Durin subname claim working for one test member

### MP1 GATE (13:00): verified human → instruction → real streamed answer → events in ticker. If red: all hands on the red module before lunch ends.

---

## SATURDAY PM — target MP2 at 19:00

### T
- [ ] T10. M4: logEvent → HCS (hash-only) + Mirror Node read-back drives ticker
- [ ] T11. M4: payForInference on every canonical.completed (from scaffold-har x402 base)
- [ ] T12. M6: storage SDK pinned; writeBrain(BrainChunk[]) on acceptance → rootHash event
- [ ] T13. M6: screenContribution (immune system, B2.2) before acceptance, verdict logged
- [ ] T14. M4: mintCapTable w/ royalty schedule (test against scripted log); announceHcs14; scheduleExpiry (build-only)

### N
- [ ] N11. M5: seat claim = Durin subname + text records; PRIMARY names for crew
- [ ] N12. M5: agent profile records (ENSIP-26 + hcsTopic + brainRoot from mock); nameTreasury
- [ ] N13. M5: grep-for-hex sweep of UI — zero-hex doctrine (A5)
- [ ] N14. M1: CV page route (B2.4) over resolve() + log data
- [ ] N15. M3: continuity ping on acceptance (B2.5)
- [ ] N16. M8: collect artifacts as they appear (HashScan links, explorer links, screenshots)

### MP2 GATE (19:00): HCS live · payment per inference · seats + agent resolve · brain writes · citations render.

## MP2.5 (~20:30) — B-list decision, apply spec B4 cut order without debate
- [ ] B2.1 First Job wired (receiveJobPayment + payoutSplit) — T
- [ ] B2.3 sybil badge in UI — N
- [ ] B2.6 challenge state UI beat — N (only if calm)
- [ ] GO/NO-GO **B3.1 Identity Check** (rule: B1 done + B2.1–3 green). If GO → N builds regulated-session toggle + necessity note (MODERATE EXTRA TIME ~2h)
- [ ] GO/NO-GO **B3.2 ERC-8004 + ENSIP-25** (only if genuinely ahead — SIGNIFICANTLY MORE TIME 3–5h) → T registry + N verification loop

---

## SATURDAY NIGHT — MP3 ~22:30 then FREEZE

### P
- [ ] P8. M7: closeSession() → Birth sequence; run clean TWICE
- [ ] P9. First Job on stage flow (outsider wallet ready on second phone)
- [ ] P10. **FREEZE. No new features after this line. None.**

### M8 finalization (N leads, T supports)
- [ ] N17. Deploy to public URL; smoke test from phone network (World rubric: 10%)
- [ ] N18. Run Hedera `validate-submission` skill on repo; fix what it flags
- [ ] N19. Videos: master → 0G cut (<3:00) → Hedera cut (<=5:00)
- [ ] N20. README final (prior-art, honesty notes, architecture, payment flow, cap-table derivation, 0G/ENS features used)
- [ ] N21. World testing doc final pass (Selfie + Identity if built)
- [ ] N22. Submission form: **Finalist judging OPT-IN**, prize selections (verify cap `[____]`), team TG/X handles, contract addresses, Agentic ID explorer link
- [ ] P11. Rehearse full demo twice; N runs it once ALONE (bus factor)

---

## SUNDAY
- [ ] 08:00 N: ENS booth prep (60s script, laptop). T: deployed-URL smoke + demo machine + backup recording queued
- [ ] 09:00 Presentation
- [ ] AM: ENS booth pitch (N) · Hedera booth pitch (both) · 0G DM pre-review follow-up
