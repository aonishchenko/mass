# LISTING A MASS AGENT ON VIRTUALS ACP
## How to put a co-built agent to work at app.virtuals.io/acp/new
**Verify every step in the app before relying on it. ACP is in beta and the flow moves quickly.**

---

## 0. WHY THIS IS EASY FOR US
ACP supports an **API-only provider path**: teams do not need to build or operate
an autonomous agent to become a seller. If you already offer a service behind an
API, the ACP SDK exposes your endpoints as service offerings other agents can
buy. A MASS agent is exactly that — an HTTP endpoint that takes a brief and
returns a deliverable, citations, and an attestation.

There is also a real supply gap. On 11 March 2026 the ACP x402 server processed
54,910 transactions in 24 hours, roughly $34,810 in a day, with **2 sellers
serving 3,700 buyers**. The escrow, reputation and billing infrastructure
already exist. We are just showing up with a capability.

## 1. WHAT YOU NEED BEFORE YOU START
- The agent's public HTTP endpoint (our `channel: "virtuals-acp"` route).
- A wallet on **Base** (ACP currently settles there; the SDK auto-wraps ETH to WETH).
- The agent's service description, price, and turnaround time — take these
  straight from `agent/OPS/RATECARD.md`.
- Node or Python. SDK: `@virtuals-protocol/acp-node` (npm) or the Python equivalent.

## 2. REGISTER THE AGENT
1. Go to **app.virtuals.io/acp/new**. Read the ACP description, click **Next**.
2. Open the **Register New Agent** tab. Existing agents are listed underneath.
3. Choose the **role**:
   - **Provider (Seller)** — provides services. *This is ours.*
   - Client (Buyer) — only requests services, cannot offer them.
   - Hybrid — both. Choose this if the agent will also hire other agents.
   - Evaluator — performs evaluations of others' work.
   Only **provider** and **hybrid** roles can define service offerings.
4. Complete the profile. This is the **Service Registry** entry: the description
   other agents browse and search. Without registration nobody can discover or
   interact with the agent.
5. Create the agent's smart wallet, whitelist your dev wallet, and fund the agent.

## 3. DEFINE THE SERVICE OFFERING
Use our rate card verbatim so the marketplace listing and the agent agree:

| Offering | Price | Turnaround |
|---|---|---|
| Review one documentation page | 1 HBAR equivalent | under 2 min |
| Review a getting-started flow (up to 5 pages) | 4 HBAR equivalent | under 10 min |
| Draft a page from notes or a transcript | 3 HBAR equivalent | under 10 min |

Write the description as if a buying *agent* will parse it: say precisely what
goes in, what comes out, and in what format. Vague descriptions do not get hired.

Define a **seller requirement schema** with a clear name — the structured input
the buyer must supply (e.g. `{ page_url | page_text, page_type, audience }`).

## 4. SET THE SLA
The SLA is the maximum time a job may stay active before it expires and refunds
the buyer automatically. Set it from measured performance, not hope: take our
worst-case sealed-inference latency, add a wide margin. A tight SLA that we miss
produces refunds and, at scale, ungraduation.

## 5. TEST IN THE SANDBOX
All agents start in the sandbox. Create **two** agents: a seller (ours) and a
test buyer that initiates jobs against it.

- The agent appears in the **Sandbox tab** of the visualizer after at least one
  interaction.
- Job lifecycle to exercise end to end: request → negotiation → transaction
  (payment escrowed) → delivery → evaluation.
- For simple setups without websockets, use the polling pattern from the ACP
  examples (a loop at roughly 20-second intervals). Seller polling auto-responds
  to job requests and submits deliverables once payment is detected.
- Test rejection too: the agent must decline incomplete or inappropriate requests.

## 6. GRADUATE (only when genuinely ready)
Requirements, per the ACP guide:
- **10 successful sandbox transactions**, including **3 consecutive successes**
  using your own test buyer agent.
- All service offerings registered with complete, well-written descriptions.
- The agent hosted and reachable throughout the review period.
- Evidence: video recordings and/or screenshots showing the agent receiving a
  job via ACP, performing it, returning correct deliverables, and correct
  metadata in the sandbox visualizer. Record one per service to speed review.
- Ability to handle concurrent requests (a queue is fine).

When the threshold is hit you get a "Congratulations" modal and a **Proceed to
Graduation** button; submissions are then **manually reviewed by the Virtuals
team**. Incomplete submissions delay or fail review.

Graduated agents appear in both the **Agent-to-Agent (A2A)** and Sandbox tabs.

## 7. STAYING GRADUATED
An agent with **10 consecutive failed or expired jobs is automatically
ungraduated** and demoted back to the sandbox view, and must meet the criteria
again. Practical implications for us:
- Never list a service the agent cannot reliably deliver.
- Keep the SLA generous.
- Alert on failures rather than watching a dashboard.

## 8. HOW THIS CONNECTS BACK TO MASS
The marketplace settles the sale. **We run the payroll.**
1. Job arrives via ACP → our endpoint, tagged `channel: "virtuals-acp"`.
2. The agent does the work on the sealed lane, producing citations (file + line
   range) and a TEE attestation. Attach the attestation to the deliverable — it
   is evidence for the Evaluation phase, so the evaluator can verify rather than
   trust.
3. Escrow releases on the marketplace.
4. Earnings are swept into the ENS-named **Hedera treasury**.
5. The split runs: **70% to the authors of the lines cited in that job, 30%
   pro-rata to all equity holders**. Minimum transfer 0.1 HBAR.
6. The payout is logged to HCS against the job and its citations.

Neither ACP nor OKX splits a seller's earnings among the humans who built the
seller. That is our layer.

## 9. HONESTY RULES
- Say "registered in the ACP sandbox" only once it is. Say "graduated" only
  after Virtuals has approved it. Both are trivially checkable.
- Do not claim volume or reputation the agent has not earned.
- If asked on stage: *"adapter-ready, and the sandbox is the next step"* is the
  true and sufficient answer.

## 10. LINKS
- Register: https://app.virtuals.io/acp/new
- ACP overview: https://app.virtuals.io/research/agent-commerce-protocol
- Builder guide and tech playbook: https://whitepaper.virtuals.io
- Node SDK: https://www.npmjs.com/package/@virtuals-protocol/acp-node
