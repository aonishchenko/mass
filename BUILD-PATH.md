# THE BUILD PATH
## A guided flow that turns a session into a complete agent
**Agent: Technical Documentation Writer · Data: `agent/BUILD-PATH.json` · Anatomy: `AGENT-ANATOMY.md` · Ownership: `SUBPROJECT-PROOF-OF-TEACHING.md`**

---

## 1. THE PROBLEM IT SOLVES
Right now a crew opens a session and faces a blank prompt. They can teach the
agent anything, in any order, which in practice means they teach it nothing.
Meanwhile a real agent needs twelve different things filled in (values, voice,
knowledge, skills, mandates, tests, price) and a first-time crew has no idea
what those are.

**The Build Path makes the agent tell the crew what it still needs.**

## 2. HOW IT WORKS
1. The session sidebar shows **Agent readiness: 4 / 12**, with the twelve slots
   from `BUILD-PATH.json`, ticked or empty.
2. Readiness is **derived from the repository**, never stored. A slot is filled
   when its files exist and pass the `detect` rule. Same discipline as the cap
   table: computed, not asserted.
3. Clicking an empty slot puts its **facilitation prompt** in the composer. The
   agent then interviews the crew about that specific part of itself.
4. The crew argues, the agent drafts, someone clicks **Propose contribution**,
   a second signer approves, it merges — and the slot ticks over.

The agent is, in effect, asking to be built.

## 3. WHY THE PROMPTS ARE WRITTEN THE WAY THEY ARE
Each prompt asks for **tacit knowledge**, not definitions. Compare:
- Bad: "What are the values of this agent?"
- Good: "What must this agent never do, even when a user asks nicely?"
- Bad: "What is your documentation style?"
- Good: "Think of the last time you watched someone fail to follow your docs.
  Where exactly did they stop?"
People cannot answer the first question. They answer the second instantly, and
the answer is worth citing later. Every prompt in `BUILD-PATH.json` follows that
rule: ask for the rule of thumb, the red line, the embarrassing example, the
sneaky attack.

## 4. THE TWELVE SLOTS
| # | Slot | Asks the crew | Earns ownership |
|---|---|---|---|
| 1 | Purpose | what it is for, and what it must refuse | no |
| 2 | Soul | red lines: what it must never do | **yes** |
| 3 | Voice | banned words, page structure, house style | **yes** |
| 4 | Knowledge | where you watched a reader actually get stuck | **yes** (ongoing) |
| 5 | Sources and rights | where knowledge came from, may we use it | no |
| 6 | Skills | how you personally review a page, in order | **yes** |
| 7 | Examples | a paragraph you are proud of, and one that embarrasses you | no |
| 8 | Mandates | spend limits, legal limits, when to fetch a human | no |
| 9 | Harness | which tools it may touch | no |
| 10 | Tests and red team | how you would test a new hire, and trick them | no |
| 11 | Rate card | what one page review costs | no |
| 12 | Ownership | fills itself at the Birth | derived |

Slot 4 never completes. Knowledge is the ongoing work; the other eleven are
setup. That asymmetry is honest and worth saying aloud.

## 5. WHAT THIS DOES FOR THE PITCH
- **Answers "what do I do with this?"** — the blank-prompt problem disappears.
- **Makes progress visible.** Readiness climbing 4/12 → 6/12 during the demo is
  a progress bar the audience feels.
- **Proves it is not a chat app.** A chat app has no notion of being finished.
- **Explains the anatomy without a slide.** The judge learns what an agent is
  made of by watching the sidebar.
- **Makes contributions purposeful**, which makes the cap table meaningful:
  people own the *parts* they filled, not just some lines.

## 6. IMPLEMENTATION (MVP first, ~45 min)
**MVP, tonight:**
- Read `BUILD-PATH.json`, render twelve rows, tick by running each `detect` rule
  against the repository.
- Header: "Agent readiness N / 12".
- Click a row → its `prompt` goes into the composer. Nothing else.

**Nice, if time:**
- Highlight the next unfilled slot as "suggested next".
- On merge, animate the slot ticking over.
- Show which seat filled each slot (ties the Build Path to the cap table).

**Do not build:** enforced ordering, blocking, or a wizard that traps the user.
The path is a suggestion, not a rail. Crews must be able to jump anywhere.

## 7. DEMO USE (10 seconds, high value)
Open on "Agent readiness 4 / 12" with **Soul** and **Knowledge** already ticked
from earlier work. Click the empty **Knowledge** slot. The agent asks *"think of
the last time you watched someone fail to follow your docs. Where exactly did
they stop?"* Someone answers with a real war story, it merges, the counter ticks
to 5 / 12.
> "The agent knows what it still needs. It asks us to build it."
