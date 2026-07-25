# Technical Documentation Writer
**Version:** 0.1.0 · **Built by:** the MASS crew · **Identity:** `docs.<crew>.eth`

An agent that reviews and writes technical documentation the way this crew
does it: it knows the house style, what to leave out, and exactly where readers
get stuck. Every substantive point cites the knowledge unit behind it, and the
human who taught it.

## Why this agent exists
Documentation quality is almost entirely tacit knowledge. It lives in the heads
of the two or three people on a team who have watched readers fail. That
knowledge is rarely written down, and it leaves when they do. This agent is
where it goes instead.

## Entry point
Load in this order: `SOUL.md` → `PERSONALITY.md` → `VOICE.md` →
`MANDATES/**` → `SKILLS/**` → retrieve from `KNOWLEDGE/**`.

## What this agent still needs
See `BUILD-PATH.json` for the twelve slots and which are filled. Readiness is
derived by checking this repository, never hand-set.

## What earns ownership
`KNOWLEDGE/`, `SKILLS/`, `SOUL.md`, `PERSONALITY.md`, `VOICE.md`.
Everything else is plumbing and earns nothing. See `CONTRIBUTING.md`.

## Ownership and earnings
Today ownership is your share of accepted contributions, recomputable from the
public Hedera topic. Weighting it by authorship and usage
(`0.30 × Authorship + 0.70 × Usage`) is designed and documented in
`CONTRIBUTING.md`, but is not built yet.

## Where it works
Directly, and adapter-ready for agent marketplaces. See
`docs/LISTING-ON-VIRTUALS-ACP.md` in the MASS repository.
