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
      // A build-path answer is an ordinary message. It is NOT a signed teaching
      // point: nothing enters the brain or the cap table without the crew
      // reviewing it, so answers flow into the conversation and are picked up
      // at harvest like anything else said in the room.
      //
      // The slot travels with it so the server can frame the turn as an answer
      // rather than a question — otherwise the brain-only rule makes the agent
      // refuse the very thing it just asked for.
      //
      // Crew chat is always draft; the canonical lane belongs to a job.
      send({ kind: "instruct", text, lane: "draft", slot });
    },
  });

  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>;
}
