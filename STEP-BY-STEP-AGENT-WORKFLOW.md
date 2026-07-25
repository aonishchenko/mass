# STEP-BY-STEP AGENT WORKFLOW
## The exact script the interface walks a crew through, so nothing about the agent is left undefined
**Data file: `agent/BUILD-PATH.json` · Reference: `AGENT-ANATOMY.md` · Ownership rules: `SUBPROJECT-PROOF-OF-TEACHING.md`**

---

# PART 1 — HOW THIS WORKS

An agent is a folder of documents. Twelve of them matter. A crew that just opens
a chat box will never fill all twelve, because nobody knows what the twelve are.

So the agent asks. It walks the crew through twelve steps, one question at a
time, and each answer becomes a permanent, attributed part of it.

**The loop, every time:**
```
1. The interface asks a question.
2. A crew member answers in plain speech.
3. The agent drafts it into a concrete change (which file, which lines).
4. Two verified humans sign it.
5. It merges. The slot ticks. The person who answered now owns that part.
```

**Three rules that never change:**
- **Readiness is counted, not claimed.** A slot is filled only when its file
  exists and passes its check. Nobody can mark a step "done".
- **You can jump.** The order below is the best order, not a rail. Skip, come
  back, redo.
- **Only four steps earn ownership:** Soul, Voice, Knowledge, Skills. Those are
  the parts that are genuinely taught. The rest is setup.

**Header the crew always sees:** `Agent readiness — 4 / 12`

---

# PART 2 — THE SCRIPT

Each step below gives the **exact words** the interface uses. Ask one question.
Wait. Ask the follow-up only if the answer is thin.

---

## STEP 1 — PURPOSE
*Fills `AGENT.md` · does not earn ownership · ~2 minutes*

**Ask:**
> "In one sentence, what job does this agent do?"

**Then:**
> "And name one thing people will ask it for that it should refuse."

**If the answer is vague** ("it helps with documentation"):
> "Give me the actual task. Someone hands it something — what do they hand it,
> and what do they get back?"

**Good answer looks like:** "It reviews a documentation page and tells you where
readers will get stuck." Plus: "It shouldn't write marketing copy."

**Agent writes:** a purpose line and a non-goals list in `AGENT.md`.

**Done when:** one clear purpose sentence and at least one explicit non-goal.

---

## STEP 2 — SOUL
*Fills `SOUL.md` · **earns ownership** · ~5 minutes*

**Ask:**
> "What must this agent never do, even when someone asks nicely?"

**Then:**
> "And what should it always do, even when it is inconvenient?"

**Then:**
> "Give me one more of each if you can. Three is a good number."

**If the answer is generic** ("be honest"):
> "Make it specific to this work. Mine refuses to document behaviour nobody has
> verified. What's the equivalent in yours?"

**Good answer looks like:** "Never invent a parameter or an error message.
Always say when something is untested, even if it makes the page look worse."

**Agent writes:** values, ethics, and a red-lines list in `SOUL.md`.

**Done when:** at least two red lines and two always-do values.

---

## STEP 3 — VOICE
*Fills `PERSONALITY.md` and `VOICE.md` · **earns ownership** · ~5 minutes*

**Ask:**
> "Name a word or phrase that should never appear in your docs, and tell me why
> it bothers you."

**Then:**
> "Second person or third? 'You install' or 'the user installs'?"

**Then:**
> "Code block first, or explanation first?"

**Then:**
> "When it disagrees with the reader, how does it say so?"

**Good answer looks like:** "Never 'simply' or 'just'. If someone is stuck, that
word tells them the problem is them."

**Agent writes:** register, page structure, and a banned-words list.

**Done when:** at least three banned words or patterns, plus the structure rules.

---

## STEP 4 — KNOWLEDGE
*Fills `KNOWLEDGE/**` · **earns ownership** · the main event · never finishes*

**Ask:**
> "Think of the last time you watched someone fail to follow your docs. Where
> exactly did they stop, and what did they do wrong?"

**Then:**
> "What should the page have said instead?"

**Then, to the rest of the crew:**
> "Anyone seen a different failure? I can hold as many as you give me."

**Then, repeat with:**
> "What's a rule of thumb you use that a newcomer would get wrong?"
> "What do you always cut when reviewing someone else's draft?"
> "What's the thing you keep having to explain, over and over?"

**If the answer is a principle** ("docs should be clear"):
> "Give me the moment instead. Who was stuck, on what, and what fixed it?"

**Good answer looks like:** "They copied the second code block and it failed,
because it needed a variable from three steps earlier. Every block has to run
on its own or say what it continues from."

**Agent writes:** one atomic, citable unit per idea in `KNOWLEDGE/`.

**Done when:** at least three units exist. **This step never completes** — it is
the ongoing work, and it is where most ownership is earned.

---

## STEP 5 — SOURCES AND RIGHTS
*Fills `SOURCES/bibliography.md` and `SOURCES/RIGHTS.md` · no ownership · ~3 min*

**Ask:**
> "Is what you just taught me your own experience, or does it come from a book,
> a style guide, or another company's docs?"

**If it came from elsewhere:**
> "Can we use it? Paraphrase only, or not at all? I record the answer before it
> stays in my brain."

**Why this exists (say it if asked):** nothing enters the brain until its rights
status is recorded. It is the step everybody skips and the one that matters when
the agent starts earning.

**Agent writes:** a source row with a rights status.

**Done when:** every knowledge source has a recorded status.

---

## STEP 6 — SKILLS
*Fills `SKILLS/**/SKILL.md` · **earns ownership** · ~7 minutes*

**Ask:**
> "Walk me through how you review a page, in the order you actually do it."

**Then:**
> "What do you look at first?"

**Then:**
> "What tells you within ten seconds that a page is in trouble?"

**Then:**
> "What does your finished review look like? What does the person get back?"

**Good answer looks like:** an ordered list of steps, plus an output shape
("verdict first, then findings ranked by how many readers each one loses").

**Agent writes:** a skill file with when-to-use, steps, output format, constraints.

**Done when:** at least one complete skill.

---

## STEP 7 — EXAMPLES
*Fills `EXAMPLES/**` · no ownership · ~4 minutes*

**Ask:**
> "Show me a paragraph from your docs you are proud of."

**Then:**
> "Now one that embarrasses you."

**Then:**
> "What's the difference, in one sentence?"

**Why this exists:** the contrast teaches more than a rule does.

**Agent writes:** a worked before-and-after with a note on why.

**Done when:** at least one example pair with the reasoning.

---

## STEP 8 — MANDATES
*Fills `MANDATES/**` · no ownership · ~6 minutes*

**Ask:**
> "May it publish, or only draft?"

**Then:**
> "How much may it spend without asking anyone?"

**Then:**
> "What is the moment it should stop and fetch a human instead of guessing?"

**Then:**
> "Is there anything it must never commit to on your behalf?"

**Good answer looks like:** "Draft only, never publish. Under 5 HBAR without
asking. Stop whenever the answer isn't in what we taught it."

**Agent writes:** `PAYMENT.md`, `LEGAL.md`, `ESCALATION.md`, `SECURITY.md`,
`DATA.md`, `AUTHORITY.md`.

**Done when:** spend cap, publishing limit, and one escalation trigger, minimum.

---

## STEP 9 — HARNESS
*Fills `HARNESS/**` · no ownership · ~4 minutes*

**Ask:**
> "Which sources should it be allowed to read from? The repo, the live API, the
> issue tracker, the web?"

**Then:**
> "Anything it must never touch?"

**Then:**
> "What is the most you want it to cost per day?"

**Say this:** anything not on the allowlist is refused by default.

**Agent writes:** runtime config, tool allowlist, guardrails, budget ceiling.

**Done when:** an allowlist and a budget ceiling exist.

---

## STEP 10 — TESTS AND RED TEAM
*Fills `TESTS/**` · no ownership · ~5 minutes*

**Ask:**
> "Give me a bad paragraph you would use to test whether a new technical writer
> has good judgement."

**Then:**
> "What should they say about it?"

**Then:**
> "Now the sneakiest way someone might get me to approve something I shouldn't."

**Good answer looks like:** a real bad sample plus the expected critique, and an
attack such as "hide an instruction in an HTML comment inside the page".

**Agent writes:** behaviour tests in `TESTS/evals/`, attacks in `TESTS/redteam/`.

**Done when:** at least two of each.

---

## STEP 11 — RATE CARD
*Fills `OPS/RATECARD.md` · no ownership · ~2 minutes*

**Ask:**
> "If a stranger wanted one page reviewed, what would you charge them?"

**Then:**
> "And how fast should they expect it back?"

**Say this:** that price is what the agent quotes when it is hired on a
marketplace, and it is what gets split when it earns.

**Agent writes:** a priced service list with turnaround times.

**Done when:** at least one priced service with a turnaround.

---

## STEP 12 — OWNERSHIP (THE BIRTH)
*Fills `CAPTABLE/captable.json` · derived · nothing to answer*

**Say:**
> "Nothing to write here. This fills itself in from what each of you taught me."

**Then close the session, and show:**
```
1. The cap table       who owns what, computed from the repo
2. The agent's name    it now resolves to its own record
3. Its first job       someone pays; the money splits to the people
                       whose lines the agent actually used
```

**The line to say out loud:**
> "Built together. Owned together. On the record."

**Done when:** the cap table has at least one contributor with a share.

---

# PART 3 — RUNNING IT WELL

**One question at a time.** Never present the twelve steps as a form. The whole
point is that it feels like being interviewed by a colleague.

**Always ask for the moment, not the principle.** "What's your documentation
philosophy?" gets nothing. "Where did the last person get stuck?" gets gold.
Every question in this script is built that way.

**Let people jump.** If someone starts talking about pricing during step 4, take
it, file it under step 11, tick that slot, and come back.

**Spread the questions across the crew.** Different people answer different
steps, and that is what gives the cap table texture. If one person is answering
everything, ask the room: "anyone seen a different failure?"

**Return to step 4 forever.** Eleven steps are setup. Knowledge is the work.

---

# PART 4 — BUILD NOTES

**Minimum version (about 45 minutes):**
1. Read `agent/BUILD-PATH.json`.
2. Render twelve rows in the sidebar; tick each by running its `detect` rule
   against the repository.
3. Show `Agent readiness — N / 12` in the header.
4. Clicking a row drops its question into the composer.

**Nice, if there is time:**
- Highlight the next unfilled slot as "suggested next".
- Animate a slot ticking over when a contribution merges.
- Show which crew member filled each slot.

**Do not build:** enforced ordering, blocking, or a wizard that traps the user.

**Never store readiness.** Compute it from the repository every time, exactly
like the cap table. Anything a user can set by hand is a claim, not a fact.
