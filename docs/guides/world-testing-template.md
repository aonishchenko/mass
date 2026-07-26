# MASS × World — Beta Testing Documentation
**Product(s) tested: Selfie Check (+ Identity Check if B3.1 built) within MASS (Multiplayer Agent Session System), ETHGlobal Lisbon 2026.**
**This document is a required deliverable for the Selfie Check Beta and Identity Check Beta tracks, and feedback quality is 25% of the judging rubric. Fill entries AS THEY HAPPEN, dated with time (WEST). Don't be nice — they asked for that explicitly.**

## 1. How MASS uses each credential (context for reviewers)
- **Selfie Check** — authorization/fairness/abuse-prevention signal, NOT login:
  gates the Builder tier (T2) that may instruct the shared agent; sybil score
  recorded per seat and surfaced as a risk badge; continuity re-verification on
  each accepted contribution so a cap-table share cannot be claimed from an
  unattended device.
- **AgentKit** — Signer tier (T3): humans delegate to the SHARED session agent;
  quorum of T3 proofs required for consequential actions (multi-principal,
  time-varying delegation).
- **Identity Check** (if built) — one "regulated session" COMMIT action gated
  by an over-18/jurisdiction attestation. See §5 for necessity justification.

## 2. Developer feedback log (SDK/API friction, docs gaps, setup issues)
| # | Date/time | Product | What we did | What happened | Friction/gap | Suggestion | Severity (1-5) |
|---|---|---|---|---|---|---|---|
| 1 | | | | | | | |
| 2 | | | | | | | |
| 3 | | | | | | | |
(target: >=10 dated entries by freeze; include portal setup, first verify call,
server-side verification wiring, error messages verbatim, docs pages that
helped or misled, time-to-integrate per step)

## 3. User feedback log (UX friction, comprehension, drop-off, camera/selfie flow)
| # | Date/time | Tester (role, not name) | Step | Observation (what confused/delayed/failed) | Quote if any | Suggestion |
|---|---|---|---|---|---|---|
| 1 | | | | | | |
| 2 | | | | | | |
(testers: both team members + at least 2 other hackers at the venue; note
comprehension of WHY verification is asked, camera flow issues, drop-off points,
re-verification annoyance threshold for continuity pings)

## 4. Their preferred-feedback headings (fill each explicitly before submission)
- **Integration experience** (how it went, time-to-integrate, blockers):
- **Ease of integration** (where docs/SDK helped, where they got in the way):
- **Value of Selfie Check** (did the assurance let us act — block/gate/step-up — and how useful in practice):
- **Value of the sybil score** (how it factors into our decisions; what bands we'd use):
- **POH (Orb) vs Selfie Check cohorts** (differences observed between T3 and T2 users — behavior, friction, trust):
- **Overall sentiment** (would we keep using it and expand across the product):

## 5. Identity Check only — attribute necessity & data minimization (required)
- Attribute requested: over-18 (and/or jurisdiction) — boolean response only.
- Why necessary: the regulated-session toggle demonstrates compliance-gated
  agent actions; eligibility must be verified, but identity itself is
  irrelevant to MASS.
- Minimization: we receive ONLY "criteria met"; no age, name, document data is
  requested, transmitted, or stored; attestation hash (not content) is logged;
  verification is per-session, not persisted beyond it.
- Retention: session-scoped; deleted with session state.

## 6. Summary verdict (write last, 5 sentences max)
