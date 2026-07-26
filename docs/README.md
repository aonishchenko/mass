# MASS documentation

Everything that is not the [root README](../README.md) lives here. Start with the
architecture if you are new; go to `spec/` if you are about to change code.

```
docs/
  architecture/   what the system is, and the diagram
  spec/           the three specs — the source of truth for behaviour
  guides/         how to run, set up, and operate things
  partners/       one page per sponsor: what we used and how deep it goes
  tasks/          per-lane task briefs and design notes
  audits/         full-repo bug hunts
  hackathon/      pitch, submission pack, provenance
  agent/          the agent's own repo files (the thing the crew builds)
```

## Architecture

| Doc | Purpose |
|-----|---------|
| [architecture/architecture.md](./architecture/architecture.md) | The system in one page: components, the request path, where each chain sits, and why the sidecar exists |

## Specs — the source of truth

Code comments cite these by section (`shared-session-spec §7.5.3`), so section
numbers are load-bearing. Change the spec when you change the behaviour.

| Doc | Purpose |
|-----|---------|
| [spec/MASS-specs.md](./spec/MASS-specs.md) | Master spec — positioning, authority model, interface contracts, module cards, merge points |
| [spec/shared-session-spec.md](./spec/shared-session-spec.md) | Session core — WS protocol, event sourcing and replay, lanes, contribution lifecycle, 0G brain + archive |
| [spec/hedera-spec.md](./spec/hedera-spec.md) | Hedera module — HCS provenance ledger, pay-per-inference, the payroll split, HTS cap table |

## Guides

| Doc | Purpose |
|-----|---------|
| [guides/BUILD-PATH.md](./guides/BUILD-PATH.md) | The guided flow that turns a session into a complete agent (twelve slots) |
| [guides/STEP-BY-STEP-AGENT-WORKFLOW.md](./guides/STEP-BY-STEP-AGENT-WORKFLOW.md) | The exact script the interface walks a crew through |
| [guides/ENS-MANUAL.md](./guides/ENS-MANUAL.md) | How the agent's name works, in plain English |
| [guides/ENS-BASE-SEPOLIA-GUIDE.md](./guides/ENS-BASE-SEPOLIA-GUIDE.md) | Wiring ENS subnames on an L2 via Durin |
| [guides/WORLD-SETUP.md](./guides/WORLD-SETUP.md) | Registering the app with World and configuring Selfie Check |
| [guides/world-testing.md](./guides/world-testing.md) | Notes from testing World in practice |
| [guides/world-testing-template.md](./guides/world-testing-template.md) | World beta testing write-up (a required prize deliverable) |
| [guides/LISTING-ON-VIRTUALS-ACP.md](./guides/LISTING-ON-VIRTUALS-ACP.md) | Putting a co-built agent to work on the Virtuals ACP marketplace |
| [guides/MARKETPLACE-EARNINGS.md](./guides/MARKETPLACE-EARNINGS.md) | Reading the agent's earnings, and how revenue becomes contributor payouts |

## Partners

One page per sponsor — what we used, how deep the integration goes, and what
would break if you removed it.

[0G](./partners/0G.md) · [ENS](./partners/ENS.md) · [Hedera](./partners/HEDERA.md) · [World](./partners/WORLD.md) · [overview](./partners/README.md)

## Tasks and design notes

| Doc | Purpose |
|-----|---------|
| [tasks/TASKBOARD.md](./tasks/TASKBOARD.md) | Checkbox execution plan per lane, with merge-point gates |
| [tasks/PAYOUT-DESIGN.md](./tasks/PAYOUT-DESIGN.md) | How a job payment is split, and why use is measured rather than asserted |
| [tasks/ZG-TASK.md](./tasks/ZG-TASK.md) · [tasks/HEDERA-TASK.md](./tasks/HEDERA-TASK.md) · [tasks/WORLD-TASK.md](./tasks/WORLD-TASK.md) · [tasks/ENS-TASK.md](./tasks/ENS-TASK.md) | Per-chain integration briefs |

## Audits

| Doc | Purpose |
|-----|---------|
| [audits/bughunt1.md](./audits/bughunt1.md) | First full-repo audit |
| [audits/bughunt2.md](./audits/bughunt2.md) | Follow-up audit after the first round of fixes |

## Hackathon

| Doc | Purpose |
|-----|---------|
| [hackathon/PITCH.md](./hackathon/PITCH.md) | 4-minute pitch script, slide sequence, Q&A playbook |
| [hackathon/SUBMISSION-PACK.md](./hackathon/SUBMISSION-PACK.md) | Demo script, booth pitches, video plan, per-track checklists |
| [hackathon/PROVENANCE.md](./hackathon/PROVENANCE.md) | How these planning documents were developed |

## The agent's own repo

These are not documentation about MASS — they are the files of the agent the
crew builds, kept here as the worked example.

| Doc | Purpose |
|-----|---------|
| [agent/AGENT.md](./agent/AGENT.md) | The Technical Documentation Writer: what it is, and what it refuses |
| [agent/CONTRIBUTING.md](./agent/CONTRIBUTING.md) | How a contribution is proposed, signed, merged, and what it earns |
