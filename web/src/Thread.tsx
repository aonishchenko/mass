/**
 * Claude-styled thread — cream ground, serif, minimal chrome, per the
 * assistant-ui Claude example. Adapted for MASS: a lane switch in the composer
 * and citation highlighting in assistant output (MASS-specs MUST #5).
 */

import {
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
} from "@assistant-ui/react";
import { ArrowUpIcon, ShieldCheckIcon, ZapIcon } from "lucide-react";
import type { FC } from "react";
import type { Lane, SessionView } from "./session";

/** Highlights (per <name>'s contribution #<n>) so the claim is visible. */
export const CitedText: FC<{ text: string }> = ({ text }) => {
  const parts = text.split(/(\(per [^)]*'s contribution #\d+\))/g);
  return (
    <>
      {parts.map((p, i) =>
        /^\(per .*'s contribution #\d+\)$/.test(p) ? (
          <span key={i} className="citation" title="cited from the agent's brain">
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
};

const UserMessage: FC = () => (
  <MessagePrimitive.Root className="mx-auto w-full max-w-3xl px-4 py-3">
    <div className="ml-auto w-fit max-w-[80%] rounded-2xl bg-[#1a1a18]/5 px-4 py-2.5 text-[15px] leading-relaxed">
      <MessagePrimitive.Parts />
    </div>
  </MessagePrimitive.Root>
);

const AssistantMessage: FC<{ view: SessionView }> = ({ view }) => (
  <MessagePrimitive.Root className="mx-auto w-full max-w-3xl px-4 py-3">
    <div className="text-[15px] leading-relaxed whitespace-pre-wrap">
      <MessagePrimitive.Parts
        components={{
          Text: ({ text }) => <CitedText text={text} />,
        }}
      />
    </div>
    {!view.brainRoot && view.brainPending && (
      <p className="pt-2 text-xs text-[var(--color-faint)]">brain write pending…</p>
    )}
  </MessagePrimitive.Root>
);

const LaneToggle: FC<{ lane: Lane; setLane: (l: Lane) => void; canCommit: boolean }> = ({
  lane,
  setLane,
  canCommit,
}) => (
  <div className="flex items-center gap-1">
    <button
      type="button"
      onClick={() => setLane("draft")}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors ${
        lane === "draft"
          ? "bg-[#1a1a18]/8 text-[var(--color-ink)]"
          : "text-[var(--color-faint)] hover:bg-[#1a1a18]/5"
      }`}
    >
      <ZapIcon size={13} /> draft
    </button>
    <button
      type="button"
      onClick={() => canCommit && setLane("canonical")}
      disabled={!canCommit}
      title={canCommit ? "sealed, attested, cites teachers" : "needs 2 signers present"}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors ${
        lane === "canonical"
          ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
          : "text-[var(--color-faint)] hover:bg-[#1a1a18]/5"
      } ${!canCommit ? "cursor-not-allowed opacity-40" : ""}`}
    >
      <ShieldCheckIcon size={13} /> canonical
    </button>
  </div>
);

export const Thread: FC<{
  view: SessionView;
  lane: Lane;
  setLane: (l: Lane) => void;
  canCommit: boolean;
  seated: boolean;
}> = ({ view, lane, setLane, canCommit, seated }) => (
  <ThreadPrimitive.Root className="flex h-full flex-col bg-[var(--color-cream)] font-serif text-[var(--color-ink)]">
    <ThreadPrimitive.Viewport className="flex grow flex-col overflow-y-auto pt-10">
      <ThreadPrimitive.Empty>
        <div className="mx-auto max-w-3xl px-4 pt-16 text-center">
          <h1 className="text-3xl">Build your next team member.</h1>
          <p className="pt-2 text-sm text-[var(--color-muted)]">
            Together. On the record.
          </p>
          <p className="mx-auto max-w-md pt-6 text-[13px] leading-relaxed text-[var(--color-faint)]">
            Talk to it normally. When you say something it should keep forever,
            harvest it into the brain — the crew co-signs, and whoever taught it
            earns a share.
          </p>
        </div>
      </ThreadPrimitive.Empty>

      <ThreadPrimitive.Messages
        components={{
          UserMessage,
          AssistantMessage: () => <AssistantMessage view={view} />,
        }}
      />

      <div className="sticky bottom-0 mx-auto mt-auto w-full max-w-3xl bg-gradient-to-b from-transparent via-[var(--color-cream)]/85 to-[var(--color-cream)] px-4 pt-4 pb-3">
        {lane === "canonical" && (
          <p className="pb-2 text-center text-xs text-[var(--color-accent)]">
            Canonical lane — sealed run, paid per inference, answer cites its teachers.
          </p>
        )}
        <ComposerPrimitive.Root className="rounded-2xl border border-[#1a1a18]/12 bg-white/60 p-2.5 shadow-sm">
          <ComposerPrimitive.Input
            rows={1}
            autoFocus
            disabled={!seated || view.closed}
            placeholder={
              view.closed
                ? "session is closed"
                : seated
                  ? "Instruct the agent…"
                  : "Claim a seat to instruct the agent"
            }
            className="w-full resize-none bg-transparent px-2 py-1.5 text-[15px] outline-none placeholder:text-[var(--color-faint)] disabled:opacity-50"
          />
          <div className="flex items-center justify-between pt-1">
            <LaneToggle lane={lane} setLane={setLane} canCommit={canCommit} />
            <ComposerPrimitive.Send
              className="flex size-8 items-center justify-center rounded-full bg-[var(--color-ink)] text-[var(--color-cream)] transition-opacity hover:opacity-80 disabled:opacity-30"
              disabled={!seated || view.closed}
            >
              <ArrowUpIcon size={16} />
            </ComposerPrimitive.Send>
          </div>
        </ComposerPrimitive.Root>
        <p className="pt-2 text-center text-xs text-[var(--color-faint)]">
          {view.connected ? "live session" : "disconnected — reconnecting replays the log"}
        </p>
      </div>
    </ThreadPrimitive.Viewport>
  </ThreadPrimitive.Root>
);
