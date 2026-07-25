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
  lane,
  children,
}: {
  view: SessionView;
  send: (i: Intent) => void;
  lane: Lane;
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
      // Fire the intent only. The turn appears when the server emits `instruct`,
      // so every client sees it at the same point in the log.
      send({ kind: "instruct", text, lane });
    },
  });

  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>;
}
