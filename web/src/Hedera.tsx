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
  hcsMessages: number;
  treasuryBalanceHbar: number;
}

const consensusToLocal = (ts: string) =>
  new Date(Number(ts.split(".")[0]) * 1000).toLocaleTimeString();

export const HederaPanel: FC<{ eventCount: number }> = ({ eventCount }) => {
  const [hcs, setHcs] = useState<HcsResponse | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const shown = useVisible(10);

  // Re-poll when the local log grows: consensus lags a second or two, so an
  // anchor appears here shortly AFTER the event shows in the session log.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [h, s] = await Promise.all([
          fetch("/api/hcs").then((r) => r.json()),
          fetch("/api/stats").then((r) => r.json()),
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
    const t = setTimeout(load, 4000);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [eventCount]);

  if (!hcs?.configured) return null;

  const pending = Math.max(0, eventCount - (stats?.hcsMessages ?? 0));

  return (
    <section className="border-b border-[#1a1a18]/8 px-4 py-3">
      <h2 className="flex items-center gap-1.5 pb-2 text-[11px] tracking-wide text-[var(--color-faint)] uppercase">
        <ShieldIcon size={12} /> Anchored on Hedera
      </h2>

      <p className="pb-2 text-[11.5px] leading-snug text-[var(--color-muted)]">
        Read live from Hedera's Mirror Node — not from this browser. Only hashes
        are published; the conversation itself never leaves 0G.
      </p>

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
                {stats.treasuryBalanceHbar.toFixed(2)} ℏ <ExternalLinkIcon size={10} />
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
        {hcs.messages.slice(0, shown.count).map((m) => (
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
        {hcs.messages.length === 0 && (
          <li className="text-[11.5px] text-[var(--color-faint)]">nothing anchored yet</li>
        )}
      </ol>

      {hcs.messages.length > shown.count && (
        <button
          onClick={shown.more}
          className="mt-1.5 w-full rounded-md border border-[#1a1a18]/15 py-1 text-[11px] text-[var(--color-muted)] hover:bg-white/60"
        >
          Show 10 more ({hcs.messages.length - shown.count} left)
        </button>
      )}
    </section>
  );
};
