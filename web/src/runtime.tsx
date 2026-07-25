/**
 * Bridges assistant-ui to the session log.
 *
 * ExternalStoreRuntime is the right adapter here: the messages are not ours to
 * own — they are a projection of the DO's event log, shared by every client.
 * We never mutate them locally; we send an Intent and wait for the events.
 */

import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
  type AppendMessage,
  type ThreadMessageLike,
} from "@assistant-ui/react";
import type { ReactNode } from "react";
import type { Intent, Lane, SessionView, Turn } from "./session";

const convertMessage = (t: Turn): ThreadMessageLike => ({
  id: t.id,
  role: t.role,
  content: [{ type: "text", text: t.text }],
  status: t.running ? { type: "running" } : undefined,
});

export function MassRuntimeProvider({
  view,
  send,
  slot,
  children,
}: {
  view: SessionView;
  send: (i: Intent) => void;
  /** The build-path step on screen right now, in workflow mode. */
  slot?: string;
  children: ReactNode;
}) {
  const runtime = useExternalStoreRuntime({
    messages: view.turns,
    // Deliberately per-seat, not session-wide: assistant-ui disables the
    // composer while isRunning is true, so wiring this to the shared session
    // state let one person's in-flight run lock everybody else's keyboard —
    // which kills the co-steering beat (MASS-specs A6).
    isRunning: view.runningForYou,
    convertMessage,
    onNew: async (message: AppendMessage) => {
      const part = message.content[0];
      const text = part?.type === "text" ? part.text : "";
      if (!text.trim()) return;
      // While the agent is interviewing, what you type is an ANSWER, not a
      // question. Routing it through the agent made every interview answer come
      // back with "I haven't been taught that yet" — the agent asks something,
      // you answer, and it tells you it doesn't know. So the answer goes
      // straight to the crew for approval instead.
      if (slot) {
        send({ kind: "proposeContrib", text, source: "composer", slot });
        return;
      }
      // Fire the intent only. The turn appears when the server emits `instruct`,
      // so every client sees it at the same point in the log.
      // Crew chat is always draft; the canonical lane belongs to a job.
      send({ kind: "instruct", text, lane: "draft" });
    },
  });

  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>;
}
