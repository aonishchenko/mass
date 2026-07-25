/**
 * The Hedera panel — hedera-spec.md §4.3.
 *
 * Renders what Mirror Node returns, NOT local state. That distinction is the
 * whole claim: anyone can open the same topic on HashScan and see the same
 * rows. If the network has not returned a message yet, it is not shown.
 */

import { useEffect, useState, type FC } from "react";
import { ExternalLinkIcon, ShieldIcon } from "lucide-react";
import { hashscanMessage, useVisible } from "./ui";

interface AnchoredMessage {
  sequenceNumber: number;
  consensusTimestamp: string;
  payload: {
    id?: string;
    type?: string;
    actorTier?: string;
    seat?: string;
    payloadHash?: string;
  };
}

interface HcsResponse {
  configured: boolean;
  topicId?: string;
  topicUrl?: string;
  messages: AnchoredMessage[];
  error?: string;
}

interface Stats {
  topicId: string | null;
  treasuryAccountId: string | null;
  capTableTokenId: string | null;
  hcsMessages?: number;
  treasuryBalanceHbar?: number;
  /** Session-derived, present only when a session is supplied. */
  contributionsAccepted?: number;
  citationsServed?: number;
}

const consensusToLocal = (ts: string) =>
  new Date(Number(ts.split(".")[0]) * 1000).toLocaleTimeString();

export const HederaPanel: FC<{
  eventCount: number;
  anchorable: number;
  /** This session's event ids, used to show only our own anchors. */
  eventIds: string[];
}> = ({ eventCount, anchorable, eventIds }) => {
  const [hcs, setHcs] = useState<HcsResponse | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const shown = useVisible(10);
  const [scope, setScope] = useState<"session" | "topic">("session");
  const sessionId = new URLSearchParams(location.search).get("session") ?? "default";

  // Poll continuously while mounted. Consensus lands a second or two after the
  // local event, and firing only twice per event left the panel showing stale
  // numbers during exactly the quiet moment a judge reads it.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [h, s] = await Promise.all([
          fetch("/api/hcs").then((r) => r.json()),
          fetch(`/api/stats?session=${encodeURIComponent(sessionId)}`).then((r) => r.json()),
        ]);
        if (!cancelled) {
          setHcs(h);
          setStats(s);
        }
      } catch {
        /* transient; the next poll retries */
      }
    };
    load();
    const t = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [sessionId, eventCount]);

  if (!hcs?.configured) return null;

  /**
   * One topic per AGENT, not per session — so the raw topic carries every room
   * that ever taught this agent. Showing all of it here made the panel read as
   * "someone else's messages in my chat".
   *
   * Filtered by event id rather than by publishing a session id: room ids are
   * effectively invite links, and putting them on a public ledger would let
   * anyone reading the topic enumerate rooms. The ids we already anchor are
   * enough to recognise our own.
   */
  const mine = new Set(eventIds);
  const visible =
    scope === "session"
      ? hcs.messages.filter((m) => m.payload.id && mine.has(m.payload.id))
      : hcs.messages;

  // Only ANCHORABLE events can ever reach the topic. Comparing against the full
  // event count made the counter permanently large and always climbing, which
  // read as a broken pipeline.
  const pending = Math.max(0, anchorable - (stats?.hcsMessages ?? 0));

  // Built by omission, not by defaulting: a counter that is not wired
  // contributes no phrase at all rather than an invented "0".
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const strip = [
    stats?.contributionsAccepted !== undefined &&
      plural(stats.contributionsAccepted, "thing taught", "things taught"),
    stats?.citationsServed !== undefined &&
      plural(stats.citationsServed, "answer cited", "answers cited"),
    stats?.hcsMessages !== undefined &&
      plural(stats.hcsMessages, "on-chain record", "on-chain records"),
  ].filter((s): s is string => typeof s === "string");

  return (
    <section className="border-b border-[#1a1a18]/8 px-4 py-3">
      <h2 className="flex items-center gap-1.5 pb-2 text-[11px] tracking-wide text-[var(--color-faint)] uppercase">
        <ShieldIcon size={12} /> Anchored on Hedera
      </h2>

      <p className="pb-2 text-[11.5px] leading-snug text-[var(--color-muted)]">
        Read live from Hedera's Mirror Node — not from this browser. Only hashes
        are published; the conversation itself never leaves 0G.
      </p>

      {/* Plain-language strip. Every number here is counted — from the network
          or from the session log. Anything not yet wired is OMITTED, never
          shown as zero: these get quoted at the booth. */}
      {strip.length > 0 && (
        <p className="pb-2 text-[11.5px] leading-snug text-[var(--color-ink)]">
          {strip.join(" · ")}
        </p>
      )}

      {/* The shared topic is the point — one agent, one provenance log across
          every session that taught it — so it stays one click away. */}
      <div className="flex gap-1 pb-2">
        {(["session", "topic"] as const).map((s2) => (
          <button
            key={s2}
            onClick={() => {
              setScope(s2);
              shown.reset();
            }}
            className={`rounded-md px-2 py-0.5 text-[11px] ${
              scope === s2
                ? "bg-[var(--color-ink)] text-[var(--color-cream)]"
                : "border border-[#1a1a18]/20 hover:bg-white/60"
            }`}
          >
            {s2 === "session" ? "This session" : `Whole agent (${hcs.messages.length})`}
          </button>
        ))}
      </div>

      <dl className="space-y-1 pb-2 text-[11.5px]">
        <div className="flex justify-between gap-2">
          <dt className="text-[var(--color-muted)]">topic</dt>
          <dd>
            <a
              href={hcs.topicUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-mono text-[var(--color-accent)] hover:underline"
            >
              {hcs.topicId} <ExternalLinkIcon size={10} />
            </a>
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-[var(--color-muted)]">messages on chain</dt>
          <dd className="tabular-nums">{stats?.hcsMessages ?? 0}</dd>
        </div>
        {stats?.treasuryAccountId && (
          <div className="flex justify-between gap-2">
            <dt className="text-[var(--color-muted)]">treasury</dt>
            <dd>
              <a
                href={`https://hashscan.io/testnet/account/${stats.treasuryAccountId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-mono text-[var(--color-accent)] hover:underline"
              >
                {(stats.treasuryBalanceHbar ?? 0).toFixed(2)} ℏ <ExternalLinkIcon size={10} />
              </a>
            </dd>
          </div>
        )}
      </dl>

      {pending > 0 && (
        <p className="pb-1 text-[11px] text-amber-700">
          {pending} event{pending === 1 ? "" : "s"} awaiting consensus…
        </p>
      )}

      <ol className="space-y-1">
        {visible.slice(0, shown.count).map((m) => (
          <li key={m.sequenceNumber} className="border-b border-[#1a1a18]/6 pb-1 last:border-0">
            {/* Every anchored row opens the decoded message on HashScan — the
                point is that a reader can check us, not take our word. */}
            <a
              href={hashscanMessage(m.consensusTimestamp)}
              target="_blank"
              rel="noreferrer"
              title={`payloadHash ${m.payload.payloadHash}\nconsensus ${m.consensusTimestamp}`}
              className="flex items-baseline justify-between gap-2 rounded px-1 -mx-1 hover:bg-white/60"
            >
              <span className="min-w-0 truncate">
                <span className="text-[var(--color-faint)]">#{m.sequenceNumber}</span>{" "}
                <span className="font-mono text-[11px]">{m.payload.type}</span>
                {m.payload.seat && (
                  <span className="pl-1 font-mono text-[10px] text-[var(--color-muted)]">
                    {m.payload.seat.slice(0, 8)}
                  </span>
                )}
              </span>
              <span className="flex shrink-0 items-center gap-1 font-mono text-[10px] text-[var(--color-muted)]">
                {consensusToLocal(m.consensusTimestamp)}
                <ExternalLinkIcon size={9} />
              </span>
            </a>
          </li>
        ))}
        {visible.length === 0 && (
          <li className="text-[11.5px] text-[var(--color-faint)]">
            {scope === "session"
              ? "nothing from this session anchored yet"
              : "nothing anchored yet"}
          </li>
        )}
      </ol>

      {visible.length > shown.count && (
        <button
          onClick={shown.more}
          className="mt-1.5 w-full rounded-md border border-[#1a1a18]/15 py-1 text-[11px] text-[var(--color-muted)] hover:bg-white/60"
        >
          Show 10 more ({visible.length - shown.count} left)
        </button>
      )}
    </section>
  );
};
