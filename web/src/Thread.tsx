/**
 * Claude-styled thread — cream ground, serif, minimal chrome, per the
 * assistant-ui Claude example. Adapted for MASS: citation highlighting in
 * assistant output (MASS-specs MUST #5).
 */

import {
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useMessage,
} from "@assistant-ui/react";
import { ArrowUpIcon, ShieldCheckIcon, SproutIcon, XIcon, ZapIcon } from "lucide-react";
import type { FC, ReactNode } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Lane, SessionView } from "./session";
import type { BuildStep } from "./buildPath";

const CITATION = /(\(per [^)]*'s contribution #\d+\))/g;
const IS_CITATION = /^\(per .*'s contribution #\d+\)$/;

/** Highlights (per <name>'s contribution #<n>) so the claim is visible. */
export const CitedText: FC<{ text: string }> = ({ text }) => {
  const parts = text.split(CITATION);
  return (
    <>
      {parts.map((p, i) =>
        IS_CITATION.test(p) ? (
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

/**
 * Citations arrive inside prose, so highlighting has to happen at the text-node
 * level — after markdown has produced the element tree, not before it.
 */
const highlight = (node: ReactNode): ReactNode => {
  if (typeof node === "string") return <CitedText text={node} />;
  if (Array.isArray(node)) return node.map((n, i) => <span key={i}>{highlight(n)}</span>);
  return node;
};

/**
 * The model answers in markdown. Rendering it as plain text put literal `####`
 * and `**bold**` on screen across the whole conversation pane, which made
 * correct answers look broken.
 */
export const AgentMarkdown: FC<{ text: string }> = ({ text }) => (
  <Markdown
    remarkPlugins={[remarkGfm]}
    components={{
      p: ({ children }) => <p className="pb-3 last:pb-0">{highlight(children)}</p>,
      li: ({ children }) => <li className="pb-1">{highlight(children)}</li>,
      ul: ({ children }) => <ul className="list-disc pb-3 pl-5 last:pb-0">{children}</ul>,
      ol: ({ children }) => <ol className="list-decimal pb-3 pl-5 last:pb-0">{children}</ol>,
      h1: ({ children }) => <h3 className="pb-2 text-[17px] font-semibold">{children}</h3>,
      h2: ({ children }) => <h3 className="pb-2 text-[16px] font-semibold">{children}</h3>,
      h3: ({ children }) => <h4 className="pb-1.5 text-[15px] font-semibold">{children}</h4>,
      h4: ({ children }) => <h4 className="pb-1.5 text-[15px] font-semibold">{children}</h4>,
      strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
      code: ({ children }) => (
        <code className="rounded bg-[#1a1a18]/6 px-1 py-0.5 font-mono text-[13px]">{children}</code>
      ),
      pre: ({ children }) => (
        <pre className="mb-3 overflow-x-auto rounded-lg bg-[#1a1a18]/5 p-3 font-mono text-[12.5px]">
          {children}
        </pre>
      ),
      a: ({ href, children }) => (
        <a href={href} target="_blank" rel="noreferrer" className="underline">
          {children}
        </a>
      ),
    }}
  >
    {text}
  </Markdown>
);

/** Reads the hovered message's own text out of assistant-ui's message context. */
const TeachThisButton: FC<{ onTeach: (text: string) => void }> = ({ onTeach }) => {
  const text = useMessage((m) =>
    m.content
      .map((p) => (p.type === "text" ? p.text : ""))
      .join("")
      .trim()
  );

  if (!text) return null;

  // Always visible, not hover-only: a hover affordance is invisible on touch and
  // easy to miss entirely, and this is the primary way anything enters the brain.
  return (
    <div className="flex justify-end pt-1.5">
      <button
        onClick={() => onTeach(text)}
        title="Propose this as something the agent keeps forever"
        className="flex items-center gap-1.5 rounded-md border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 px-2.5 py-1 text-xs text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)]/20"
      >
        <SproutIcon size={12} /> Teach this
      </button>
    </div>
  );
};

/**
 * Teaching starts from something you already said (§7.3 "promote"), so there is
 * one place to type. Hovering your own message offers to teach it; harvest is
 * the same act in bulk. A separate compose-a-contribution box would put the
 * fork back at input time, which is what made teaching feel like a chore.
 */
const UserMessage: FC<{ onTeach: (text: string) => void; canTeach: boolean }> = ({
  onTeach,
  canTeach,
}) => (
  <MessagePrimitive.Root className="mx-auto w-full max-w-3xl px-4 py-3">
    <div className="ml-auto w-fit max-w-[80%]">
      <div className="rounded-2xl bg-[#1a1a18]/5 px-4 py-2.5 text-[15px] leading-relaxed">
        <MessagePrimitive.Parts />
      </div>
      {canTeach && <TeachThisButton onTeach={onTeach} />}
    </div>
  </MessagePrimitive.Root>
);

/** Must match UNTAUGHT in src/zg/inference.ts — the prompt and the UI agree. */
const UNTAUGHT_MARKER = "haven't been taught that yet";

/**
 * The refusal is the pitch. When the agent says it has not been taught
 * something, the next thing on screen is the way to teach it — refuse, teach,
 * answer with a citation is the whole demo in three clicks.
 */
const TeachItNow: FC<{ onFocusTeach: () => void }> = ({ onFocusTeach }) => (
  <button
    onClick={onFocusTeach}
    className="mt-3 flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-[13px] text-white transition-opacity hover:opacity-85"
  >
    <SproutIcon size={13} /> Teach it now
  </button>
);

const AssistantMessage: FC<{ view: SessionView; onFocusTeach: () => void }> = ({
  view,
  onFocusTeach,
}) => {
  const text = useMessage((m) =>
    m.content.map((p) => (p.type === "text" ? p.text : "")).join("")
  );
  const untaught = text.includes(UNTAUGHT_MARKER);

  return (
    <MessagePrimitive.Root className="mx-auto w-full max-w-3xl px-4 py-3">
      <div className="text-[15px] leading-relaxed">
        <MessagePrimitive.Parts
          components={{ Text: ({ text }) => <AgentMarkdown text={text} /> }}
        />
      </div>
      {untaught && <TeachItNow onFocusTeach={onFocusTeach} />}
      {!view.brainRoot && view.brainPending && (
        <p className="pt-2 text-xs text-[var(--color-faint)]">saving the brain…</p>
      )}
    </MessagePrimitive.Root>
  );
};

/**
 * Crew chat is always the draft lane. The canonical lane is not a mode the crew
 * picks — it is what happens when the agent is HIRED, so it belongs to "Run a
 * job" (see Rail), not to a switch above the composer. Choosing "sealed vs
 * unsealed" per message also welded the UI to one provider's capability; a job
 * is provider-independent.
 */

/**
 * The interview card — the agent asking for one specific part of itself.
 *
 * The workflow doc is emphatic that this is asked ONE QUESTION AT A TIME and
 * never rendered as a form: the whole point is that it feels like being
 * interviewed by a colleague. Follow-ups are shown quietly, to be used only if
 * the first answer is thin.
 */
const InterviewCard: FC<{ step: BuildStep; onDismiss: () => void }> = ({ step, onDismiss }) => (
  <div className="mx-auto mb-3 w-full max-w-3xl rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/8 px-4 py-3">
    <div className="flex items-start justify-between gap-3">
      <span className="text-[10px] tracking-wide text-[var(--color-accent)] uppercase">
        Step {step.order} of 12 · {step.title}
        {step.earnsOwnership && " · earns ownership"}
      </span>
      <button
        onClick={onDismiss}
        title="Answer something else instead"
        className="shrink-0 text-[var(--color-faint)] hover:text-[var(--color-ink)]"
      >
        <XIcon size={13} />
      </button>
    </div>

    <p className="pt-1.5 text-[15px] leading-snug">{step.ask}</p>

    {step.followUps.length > 0 && (
      <details className="pt-2">
        <summary className="cursor-pointer text-[11px] text-[var(--color-muted)]">
          If that felt thin, it will also ask…
        </summary>
        <ul className="list-disc pt-1 pl-4 text-[11.5px] leading-snug text-[var(--color-muted)]">
          {step.followUps.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      </details>
    )}

    <p className="pt-2 text-[11px] text-[var(--color-faint)]">
      Answer in your own words, then <em>Teach this</em> on your message. Ticks
      when the crew approves it. — {step.doneWhen}
    </p>
  </div>
);

export const Thread: FC<{
  view: SessionView;
  seated: boolean;
  /** The build-path step being answered, when the crew is in workflow mode. */
  step?: BuildStep;
  onDismissStep: () => void;
  onTeach: (text: string) => void;
}> = ({ view, seated, step, onDismissStep, onTeach }) => {
  // "Teach it now" points at the one input there is: focus it and let them type
  // the thing the agent just admitted it does not know.
  const focusComposer = () => {
    const el = document.querySelector<HTMLTextAreaElement>(".aui-composer-input, textarea");
    el?.focus();
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  return (
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
          UserMessage: () => (
            <UserMessage onTeach={onTeach} canTeach={seated && !view.closed} />
          ),
          AssistantMessage: () => (
            <AssistantMessage view={view} onFocusTeach={focusComposer} />
          ),
        }}
      />

      <div className="sticky bottom-0 mx-auto mt-auto w-full max-w-3xl bg-gradient-to-b from-transparent via-[var(--color-cream)]/85 to-[var(--color-cream)] px-4 pt-4 pb-3">
        {/* One question at a time — never a form (workflow doc, Part 3). */}
        {step && <InterviewCard step={step} onDismiss={onDismissStep} />}

        {/* Working thing first, explanation second: a new arrival gets one
            concrete thing to try, not a lecture about ownership. */}
        {seated && !step && view.turns.length === 0 && (
          <p className="pb-2 text-center text-xs text-[var(--color-muted)]">
            Try: <em>“Review this getting-started page”</em> — or ask it something it
            doesn’t know yet.
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
                : !seated
                  ? "Claim a seat to instruct the agent"
                  : step
                    ? `Answer in your own words — ${step.title.toLowerCase()}…`
                    : "Instruct the agent…"
            }
            className="w-full resize-none bg-transparent px-2 py-1.5 text-[15px] outline-none placeholder:text-[var(--color-faint)] disabled:opacity-50"
          />
          <div className="flex items-center justify-end pt-1">
            <ComposerPrimitive.Send
              className="flex size-8 items-center justify-center rounded-full bg-[var(--color-ink)] text-[var(--color-cream)] transition-opacity hover:opacity-80 disabled:opacity-30"
              disabled={!seated || view.closed}
            >
              <ArrowUpIcon size={16} />
            </ComposerPrimitive.Send>
          </div>
        </ComposerPrimitive.Root>
        <p className="pt-2 text-center text-xs text-[var(--color-faint)]">
          {!view.connected
            ? "disconnected — reconnecting replays the log"
            : view.running && !view.runningForYou
              ? "someone else is asking — you can still type"
              : "live session"}
        </p>
      </div>
    </ThreadPrimitive.Viewport>
  </ThreadPrimitive.Root>
  );
};
