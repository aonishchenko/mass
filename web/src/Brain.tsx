/**
 * WHAT DOC KNOWS — the agent's brain, made visible.
 *
 * The brain is the entire product and it used to be invisible: you could see a
 * count ("2 things taught") but never the things. You cannot value ownership of
 * something you cannot look at, so the cap table only makes sense next to this.
 *
 * Everything here is derived from accepted contributions the client already
 * holds. No new state, no new endpoint.
 */

import { useState, type FC } from "react";
import { BookOpenIcon, ChevronRightIcon } from "lucide-react";
import type { Contribution, SessionView } from "./session";

/**
 * What to call the agent on screen.
 *
 * The crew names it (`session.named`), so nothing here is hardcoded: a room
 * building a support triager should never be told its agent is called "Doc".
 * Until somebody names it, it is simply "the agent" — which is honest, and is
 * itself a prompt to go and name it.
 */
export const agentLabel = (view: Pick<SessionView, "agentName">) =>
  view.agentName?.trim() || "the agent";

/** Sentence-initial form, so copy does not read "The agent knows…" mid-line. */
export const agentLabelCap = (view: Pick<SessionView, "agentName">) => {
  const label = agentLabel(view);
  return label === "the agent" ? "The agent" : label;
};

/**
 * A short human title for a knowledge unit: its first heading, else its first
 * sentence, trimmed to something that fits a row.
 */
export function titleOf(text: string): string {
  const firstHeading = text
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.startsWith("#"));
  const raw = firstHeading
    ? firstHeading.replace(/^#+\s*/, "")
    : (text.split(/(?<=[.!?])\s/)[0] ?? text);
  const clean = raw.replace(/\s+/g, " ").trim();
  return clean.length > 58 ? `${clean.slice(0, 57)}…` : clean || "Untitled";
}

export const knownThings = (view: SessionView): Contribution[] =>
  Object.values(view.contributions).filter((c) => c.state === "accepted");

export const BrainPanel: FC<{
  view: SessionView;
  /** Set when a citation asked for a specific unit to be opened. */
  openId?: string;
}> = ({ view, openId }) => {
  const [expanded, setExpanded] = useState<string | null>(null);
  const known = knownThings(view);
  const open = expanded ?? openId ?? null;
  const name = agentLabel(view);

  return (
    <section className="border-b border-[#1a1a18]/8 px-4 py-3">
      <h2 className="flex items-center gap-1.5 pb-2 text-[11px] tracking-wide text-[var(--color-faint)] uppercase">
        <BookOpenIcon size={12} /> What {name} knows ({known.length})
      </h2>

      {known.length === 0 ? (
        // An empty state is when a newcomer is most willing to be told what to
        // do, so it instructs instead of apologising.
        <p className="text-[11.5px] leading-snug text-[var(--color-muted)]">
          {agentLabelCap(view)} doesn’t know anything yet. Ask it something — it
          will tell you honestly.
        </p>
      ) : (
        <ul className="space-y-0.5">
          {known.map((c) => {
            const isOpen = open === c.contribId;
            const teacher =
              view.seats[c.proposedBy]?.name ?? view.seats[c.proposedBy]?.ensName ?? "someone";
            return (
              <li key={c.contribId}>
                <button
                  onClick={() => setExpanded(isOpen ? null : c.contribId)}
                  className="flex w-full items-start gap-1.5 rounded-md px-1.5 py-1 text-left hover:bg-white/60"
                >
                  <ChevronRightIcon
                    size={11}
                    className={`mt-0.5 shrink-0 text-[var(--color-faint)] transition-transform ${
                      isOpen ? "rotate-90" : ""
                    }`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px]">{titleOf(c.text)}</span>
                    <span className="block text-[10px] text-[var(--color-muted)]">
                      taught by {teacher}
                    </span>
                  </span>
                </button>

                {isOpen && (
                  <p className="mb-1 ml-6 rounded-md border border-[#1a1a18]/10 bg-white/50 p-2 text-[11.5px] leading-snug whitespace-pre-wrap">
                    {c.text}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
