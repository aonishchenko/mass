/**
 * THE BUILD PATH — the twelve things every agent needs filled in.
 *
 * Source of truth for the wording: STEP-BY-STEP-AGENT-WORKFLOW.md (the exact
 * words the interface uses) and BUILD-PATH.json (the slot data). Those documents
 * are the product decision; this file is only their shape in the UI.
 *
 * Two rules from the doc are enforced here rather than assumed:
 *
 *  - **Readiness is counted, not claimed.** A step is complete only when enough
 *    contributions tagged to it have been ACCEPTED by the crew. Nothing in the
 *    UI can mark a step done, exactly like the cap table.
 *  - **You can jump.** The order below is the best order, not a rail. Nothing
 *    blocks, nothing is enforced, and steps can be done in any order.
 */

export interface BuildStep {
  id: string;
  /** 1-12, the suggested order. */
  order: number;
  title: string;
  /** The question the agent asks first. Asked one at a time — never as a form. */
  ask: string;
  /** Asked only if the first answer is thin. */
  followUps: string[];
  /** What "filled in" means, shown so the bar is never mysterious. */
  doneWhen: string;
  /** Only four steps earn ownership; the rest is setup (workflow doc, Part 1). */
  earnsOwnership: boolean;
  /** Accepted contributions needed before this ticks over. */
  needs: number;
  /**
   * Knowledge never completes — it is the ongoing work, and the doc is explicit
   * that saying so out loud is honest and worth it.
   */
  ongoing?: boolean;
  /** Step 12 fills itself from the cap table; there is nothing to answer. */
  derived?: boolean;
  minutes?: number;
}

export const BUILD_PATH: BuildStep[] = [
  {
    id: "purpose",
    order: 1,
    title: "Purpose",
    ask: "In one sentence, what job does this agent do?",
    followUps: [
      "And name one thing people will ask it for that it should refuse.",
      "Give me the actual task. Someone hands it something — what do they hand it, and what do they get back?",
    ],
    doneWhen: "One clear purpose sentence and at least one explicit non-goal.",
    earnsOwnership: false,
    needs: 1,
    minutes: 2,
  },
  {
    id: "soul",
    order: 2,
    title: "Soul",
    ask: "What must this agent never do, even when someone asks nicely?",
    followUps: [
      "And what should it always do, even when it is inconvenient?",
      "Give me one more of each if you can. Three is a good number.",
    ],
    doneWhen: "At least two red lines and two always-do values.",
    earnsOwnership: true,
    needs: 2,
    minutes: 5,
  },
  {
    id: "voice",
    order: 3,
    title: "Voice",
    ask: "Name a word or phrase that should never appear in your docs, and tell me why it bothers you.",
    followUps: [
      "Second person or third? “You install” or “the user installs”?",
      "Code block first, or explanation first?",
      "When it disagrees with the reader, how does it say so?",
    ],
    doneWhen: "At least three banned words or patterns, plus the structure rules.",
    earnsOwnership: true,
    needs: 2,
    minutes: 5,
  },
  {
    id: "knowledge",
    order: 4,
    title: "Knowledge",
    ask: "Think of the last time you watched someone fail to follow your docs. Where exactly did they stop, and what did they do wrong?",
    followUps: [
      "What should the page have said instead?",
      "Anyone seen a different failure? I can hold as many as you give me.",
      "What’s a rule of thumb you use that a newcomer would get wrong?",
      "What do you always cut when reviewing someone else’s draft?",
      "What’s the thing you keep having to explain, over and over?",
    ],
    doneWhen: "At least three units. This step never completes — it is the work.",
    earnsOwnership: true,
    needs: 3,
    ongoing: true,
  },
  {
    id: "sources",
    order: 5,
    title: "Sources and rights",
    ask: "Is what you just taught me your own experience, or does it come from a book, a style guide, or another company’s docs?",
    followUps: [
      "Can we use it? Paraphrase only, or not at all? I record the answer before it stays in my brain.",
    ],
    doneWhen: "Every knowledge source has a recorded rights status.",
    earnsOwnership: false,
    needs: 1,
    minutes: 3,
  },
  {
    id: "skills",
    order: 6,
    title: "Skills",
    ask: "Walk me through how you review a page, in the order you actually do it.",
    followUps: [
      "What do you look at first?",
      "What tells you within ten seconds that a page is in trouble?",
      "What does your finished review look like? What does the person get back?",
    ],
    doneWhen: "At least one skill with steps, output format and constraints.",
    earnsOwnership: true,
    needs: 1,
    minutes: 7,
  },
  {
    id: "examples",
    order: 7,
    title: "Examples",
    ask: "Show me a paragraph from your docs you are proud of.",
    followUps: [
      "Now one that embarrasses you.",
      "What’s the difference, in one sentence?",
    ],
    doneWhen: "At least one example pair with the reasoning.",
    earnsOwnership: false,
    needs: 1,
    minutes: 4,
  },
  {
    id: "mandates",
    order: 8,
    title: "Mandates",
    ask: "May it publish, or only draft?",
    followUps: [
      "How much may it spend without asking anyone?",
      "What is the moment it should stop and fetch a human instead of guessing?",
      "Is there anything it must never commit to on your behalf?",
    ],
    doneWhen: "Spend cap, publishing limit, and one escalation trigger.",
    earnsOwnership: false,
    needs: 2,
    minutes: 6,
  },
  {
    id: "harness",
    order: 9,
    title: "Harness",
    ask: "Which sources should it be allowed to read from? The repo, the live API, the issue tracker, the web?",
    followUps: [
      "Anything it must never touch?",
      "What is the most you want it to cost per day?",
    ],
    doneWhen: "An allowlist and a budget ceiling exist.",
    earnsOwnership: false,
    needs: 1,
    minutes: 4,
  },
  {
    id: "tests",
    order: 10,
    title: "Tests and red team",
    ask: "Give me a bad paragraph you would use to test whether a new technical writer has good judgement.",
    followUps: [
      "What should they say about it?",
      "Now the sneakiest way someone might get me to approve something I shouldn’t.",
    ],
    doneWhen: "At least two behaviour tests and two attack tests.",
    earnsOwnership: false,
    needs: 2,
    minutes: 5,
  },
  {
    id: "ratecard",
    order: 11,
    title: "Rate card",
    ask: "If a stranger wanted one page reviewed, what would you charge them?",
    followUps: ["And how fast should they expect it back?"],
    doneWhen: "At least one priced service with a turnaround.",
    earnsOwnership: false,
    needs: 1,
    minutes: 2,
  },
  {
    id: "ownership",
    order: 12,
    title: "Ownership",
    ask: "Nothing to write here. This fills itself in from what each of you taught me.",
    followUps: [],
    doneWhen: "The cap table has at least one contributor with a share.",
    earnsOwnership: false,
    needs: 0,
    derived: true,
  },
];

export const stepById = (id?: string) => BUILD_PATH.find((s) => s.id === id);

export interface StepProgress {
  step: BuildStep;
  /** Accepted contributions tagged to this step. */
  done: number;
  filled: boolean;
}

/**
 * Readiness, DERIVED. Counts accepted contributions per step — never a stored
 * flag, so nobody can mark a step complete by asserting it.
 *
 * `ownership` is the exception the doc calls out: it fills itself the moment
 * anyone holds a share.
 */
export function readiness(
  accepted: { slot?: string }[],
  capTableSize: number
): { steps: StepProgress[]; filled: number; total: number } {
  const counts = new Map<string, number>();
  for (const c of accepted) {
    if (c.slot) counts.set(c.slot, (counts.get(c.slot) ?? 0) + 1);
  }

  const steps = BUILD_PATH.map((step) => {
    const done = counts.get(step.id) ?? 0;
    const filled = step.derived ? capTableSize > 0 : done >= step.needs;
    return { step, done, filled };
  });

  return { steps, filled: steps.filter((s) => s.filled).length, total: BUILD_PATH.length };
}

/** The next step worth suggesting — a hint, never a gate. */
export const nextStep = (steps: StepProgress[]) =>
  steps.find((s) => !s.filled && !s.step.derived)?.step;
