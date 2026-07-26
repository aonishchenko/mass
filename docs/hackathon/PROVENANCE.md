# PROVENANCE — how these planning documents were developed

For full transparency at ETHGlobal Lisbon 2026, this records how MASS's
pre-build planning artifacts were produced. All *code* built during the
hackathon window is authored by the team; the documents in `/docs` are the
planning and specification output of an iterative research-and-design process
conducted with an AI assistant (Claude) as a thinking and drafting aid,
directed and reviewed by the team.

## What the AI assistant was used for
- Web research into the sponsor prize pages (0G, World, Hedera, ENS) and their
  documented requirements, plus the current grant/ecosystem landscape.
- Competitive/adjacent-project research (agent marketplaces, iNFT/ERC-7857
  projects, collective-memory and attribution projects, prior ETHGlobal
  finalists) to pressure-test novelty.
- Analysis of the sponsor workshop talks (transcripts provided by the team).
- Drafting and successive revision of the specification, task board, testing
  template, and submission pack under the team's direction.

## What the team owns and decided
- The product concept, the pivot from earlier ideas, the rebrand to the
  co-built-team-member framing, all scope and feature-bucket decisions, the
  choice of sponsors and tracks, and every GO/NO-GO call.
- All hackathon-window code and integrations.

## Document version history (planning phase)
- **v0.1–0.2** — initial concept, four-sponsor mapping, first spec.
- **v0.3** — rebrand to "co-built AI team member"; hybrid inference decision;
  feature adds (contribution-weighted minting, brain-hash ENS record, Selfie
  continuity) and drops (Identity Check, BYO-key UI, model picker).
- **v0.4** — updates after the 0G workshop: OpenAI-compatible router, ERC-7857
  delegation for native co-ownership, first-party storage encryption, language
  discipline (TEE attestation, not ZK).
- **v0.5** — modular build edition: interface contracts, dependency graph, two
  parallel lanes, merge points, per-module Definitions of Done.
- **v0.6** — final pre-build: MUST / NICE / NICE-BUT-TAKES-TIME feature
  register, server-side proof verification gate, Hedera tooling adoption,
  Durin, zero-hex doctrine, agent-cites-its-teachers, prior-art discipline;
  companion TASKBOARD, world-testing-template, and SUBMISSION-PACK created.

## Prior art acknowledged
See the "Prior art & how we differ" section of SUBMISSION-PACK.md — MASS is
positioned explicitly against Foundry Protocol, AIverse, Argus (all 0G
ecosystem), Story/OpenLedger, and Mem0.
