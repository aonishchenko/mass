import { useEffect, useState } from "react";
import { MassRuntimeProvider } from "./runtime";
import { Rail } from "./Rail";
import { Thread } from "./Thread";
import { perms, useSession, type Lane } from "./session";
import { useWorldVerify } from "./world";

export default function App() {
  const sessionId = new URLSearchParams(location.search).get("session") ?? "default";
  const { view, send, clearError } = useSession(sessionId);
  const world = useWorldVerify(sessionId);
  const [lane, setLane] = useState<Lane>("draft");

  const p = perms(view);

  // Authority is live: losing quorum must drop you out of the canonical lane,
  // not leave a button that the server will reject (MASS-specs A4).
  useEffect(() => {
    if (lane === "canonical" && !p.canCommit) setLane("draft");
  }, [lane, p.canCommit]);

  useEffect(() => {
    if (!view.error) return;
    const t = setTimeout(clearError, 4000);
    return () => clearTimeout(t);
  }, [view.error, clearError]);

  return (
    <MassRuntimeProvider view={view} send={send} lane={lane}>
      <div className="flex h-full">
        <main className="min-w-0 grow">
          <Thread
            view={view}
            lane={lane}
            setLane={setLane}
            canCommit={p.canCommit}
            seated={!!view.you}
            onTeach={(text) =>
              send({ kind: "proposeContrib", text, source: "composer" })
            }
          />
        </main>
        <Rail view={view} send={send} verify={world.verify} verifying={world.busy} />
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
