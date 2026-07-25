import { useEffect, useState } from "react";
import { MassRuntimeProvider } from "./runtime";
import { Rail } from "./Rail";
import { Thread } from "./Thread";
import { perms, useSession, type Lane } from "./session";
import { useWorldVerify } from "./world";
import { stepById, type BuildStep } from "./buildPath";

/**
 * How the crew wants to work.
 *
 * FREEFORM: just talk, and teach whatever turns out to be worth keeping.
 * AGENT WORKFLOW: the agent interviews the crew through the twelve things it
 * needs (STEP-BY-STEP-AGENT-WORKFLOW.md).
 *
 * It is a choice, not a wizard: switching is free, nothing is enforced, and a
 * crew can jump between the two mid-session.
 */
export type Mode = "freeform" | "workflow";

export default function App() {
  const sessionId = new URLSearchParams(location.search).get("session") ?? "default";
  const { view, send, clearError } = useSession(sessionId);
  const world = useWorldVerify(sessionId);

  // Remembered per room, so a refresh does not drop the crew out of the
  // interview they were halfway through.
  const [mode, setMode] = useState<Mode>(
    () => (localStorage.getItem(`mass:mode:${sessionId}`) as Mode) ?? "freeform"
  );
  const [activeStep, setActiveStep] = useState<string | undefined>();

  const chooseMode = (m: Mode) => {
    setMode(m);
    localStorage.setItem(`mass:mode:${sessionId}`, m);
    if (m === "freeform") setActiveStep(undefined);
  };

  const pickStep = (step: BuildStep) => {
    setActiveStep((current) => (current === step.id ? undefined : step.id));
  };

  const p = perms(view);

  useEffect(() => {
    if (!view.error) return;
    const t = setTimeout(clearError, 4000);
    return () => clearTimeout(t);
  }, [view.error, clearError]);

  return (
    <MassRuntimeProvider view={view} send={send}>
      {/*
        B7: judges browse on phones. Below md the rail stacks BELOW the
        conversation instead of being cut off, and nothing scrolls sideways.
      */}
      <div className="flex h-full flex-col overflow-y-auto md:flex-row md:overflow-hidden">
        <main className="min-h-[60vh] min-w-0 grow md:min-h-0">
          <Thread
            view={view}
            seated={!!view.you}
            step={mode === "workflow" ? stepById(activeStep) : undefined}
            onDismissStep={() => setActiveStep(undefined)}
            onTeach={(text) =>
              // Tag the contribution with the step it answers, so readiness can
              // be counted from accepted work rather than asserted.
              send({
                kind: "proposeContrib",
                text,
                source: "composer",
                slot: mode === "workflow" ? activeStep : undefined,
              })
            }
          />
        </main>
        <Rail
          view={view}
          send={send}
          verify={world.verify}
          verifying={world.busy}
          mode={mode}
          setMode={chooseMode}
          activeStep={activeStep}
          onPickStep={pickStep}
        />
      </div>

      {/* IDKit mounts once, here. Driven imperatively by useWorldVerify. */}
      {world.widget}

      {/* Honesty banner — the demo must never imply a proof was checked when it
          was not (World rubric). Shown whenever the DEV fallback issued a token. */}
      {view.devMode && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 rounded-md bg-amber-500/95 px-3 py-1.5 font-sans text-[12px] font-medium text-amber-950 shadow">
          DEV MODE — identities are not verified against World (no app configured)
        </div>
      )}

      {view.error && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 rounded-lg bg-[var(--color-ink)] px-4 py-2 font-sans text-[13px] text-[var(--color-cream)] shadow-lg">
          {view.error}
        </div>
      )}
    </MassRuntimeProvider>
  );
}
