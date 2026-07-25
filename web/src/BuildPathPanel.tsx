/**
 * THE BUILD PATH panel — the agent asking to be built.
 *
 * A crew that opens a blank chat teaches the agent nothing, because nobody knows
 * what an agent needs. This turns that around: the agent shows the twelve things
 * it still needs and interviews the crew about each one
 * (STEP-BY-STEP-AGENT-WORKFLOW.md).
 *
 * Two rules from the doc are visible in the behaviour:
 *   - readiness is COUNTED from accepted contributions, never marked done here;
 *   - the order is a suggestion, so every step stays clickable at any time.
 */

import type { FC } from "react";
import { CheckIcon, CircleDashedIcon, InfinityIcon } from "lucide-react";
import { readiness, nextStep, type BuildStep } from "./buildPath";
import type { Contribution } from "./session";

export const BuildPathPanel: FC<{
  contributions: Record<string, Contribution>;
  capTableSize: number;
  activeStep?: string;
  onPick: (step: BuildStep) => void;
  disabled?: boolean;
}> = ({ contributions, capTableSize, activeStep, onPick, disabled }) => {
  const accepted = Object.values(contributions).filter((c) => c.state === "accepted");
  const { steps, filled, total } = readiness(accepted, capTableSize);
  const suggested = nextStep(steps);

  return (
    <section className="border-b border-[#1a1a18]/8 px-4 py-3">
      <div className="flex items-baseline justify-between pb-1">
        <h2 className="text-[11px] tracking-wide text-[var(--color-faint)] uppercase">
          Agent readiness
        </h2>
        <span className="text-[13px] font-semibold tabular-nums">
          {filled} / {total}
        </span>
      </div>

      {/* A progress bar the room can feel moving during a demo. */}
      <div className="mb-2 h-1 w-full overflow-hidden rounded-full bg-[#1a1a18]/10">
        <div
          className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-500"
          style={{ width: `${(filled / total) * 100}%` }}
        />
      </div>

      <p className="pb-2 text-[11.5px] leading-snug text-[var(--color-muted)]">
        The agent needs twelve things. Pick one and it will interview you about it.
        Ticks are counted from what the crew accepted — nothing here can be marked
        done by hand.
      </p>

      <ol className="space-y-0.5">
        {steps.map(({ step, done, filled: isFilled }) => {
          const isActive = activeStep === step.id;
          const isSuggested = suggested?.id === step.id && !isFilled;

          return (
            <li key={step.id}>
              <button
                onClick={() => onPick(step)}
                disabled={disabled || step.derived}
                title={step.doneWhen}
                className={`flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors ${
                  isActive
                    ? "bg-[var(--color-accent)]/12 ring-1 ring-[var(--color-accent)]/40"
                    : "hover:bg-white/60"
                } ${step.derived ? "cursor-default" : ""} disabled:hover:bg-transparent`}
              >
                <span
                  className={`flex size-4 shrink-0 items-center justify-center rounded-full text-[9px] ${
                    isFilled
                      ? "bg-emerald-600/20 text-emerald-800"
                      : "bg-[#1a1a18]/8 text-[var(--color-faint)]"
                  }`}
                >
                  {isFilled ? <CheckIcon size={10} /> : step.order}
                </span>

                <span className="min-w-0 flex-1 truncate text-[12.5px]">
                  {step.title}
                  {/* Knowledge never completes, and saying so is honest. */}
                  {step.ongoing && (
                    <InfinityIcon
                      size={10}
                      className="ml-1 inline text-[var(--color-faint)]"
                    />
                  )}
                </span>

                {step.earnsOwnership && (
                  <span
                    title="Answering this earns you a share of the agent"
                    className="shrink-0 rounded-full bg-[var(--color-accent)]/12 px-1.5 text-[9px] text-[var(--color-accent)]"
                  >
                    earns
                  </span>
                )}

                <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-[var(--color-faint)]">
                  {step.derived ? "auto" : `${Math.min(done, step.needs)}/${step.needs}`}
                </span>
              </button>

              {isSuggested && !isActive && (
                <p className="pb-0.5 pl-8 text-[10px] text-[var(--color-accent)]">
                  suggested next
                </p>
              )}
            </li>
          );
        })}
      </ol>

      {filled === total && (
        <p className="pt-2 text-[11.5px] text-emerald-800">
          Every slot filled. Knowledge keeps growing — close the session whenever
          you are ready.
        </p>
      )}
    </section>
  );
};

/** Tiny inline marker used by the freeform view to hint the workflow exists. */
export const ReadinessHint: FC<{
  contributions: Record<string, Contribution>;
  capTableSize: number;
}> = ({ contributions, capTableSize }) => {
  const accepted = Object.values(contributions).filter((c) => c.state === "accepted");
  const { filled, total } = readiness(accepted, capTableSize);
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-[var(--color-faint)]">
      <CircleDashedIcon size={9} /> {filled}/{total} defined
    </span>
  );
};
