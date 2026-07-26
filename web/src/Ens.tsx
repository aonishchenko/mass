/**
 * ENS identity panel (M5) — the agent as a resolvable, co-owned employee.
 * Shows the agent's ENS name, whether it verifies (forward/reverse), and a link
 * to the public CV page rendered from ENS. Live from /api/ens/cv.
 */

import { EnsLink, EnsMark } from "./Brand";
import { useEffect, useState, type FC } from "react";

interface CvResponse {
  profile: { name: string; availability: string; contributionCount: number; crewSize: number };
  resolved: { verified: boolean; dev: boolean };
}

export const EnsPanel: FC<{ sessionId: string; closed: boolean }> = ({ sessionId, closed }) => {
  const [data, setData] = useState<CvResponse | null>(null);

  // Refetch at the Birth (closed) so the record reflects the final cap table.
  useEffect(() => {
    let live = true;
    fetch(`/api/ens/cv?session=${encodeURIComponent(sessionId)}`)
      .then((r) => r.json())
      .then((d) => live && setData(d))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [sessionId, closed]);

  // No parent name owned by this deployment => no identity to show. We say so
  // rather than inventing a name under a domain we do not control.
  if (!data?.profile) return null;
  if (!data.profile.name) {
    return (
      <section className="border-b border-[#1a1a18]/8 px-4 py-3">
        <h2 className="flex items-center gap-1.5 pb-2 text-[11px] tracking-wide text-[var(--color-faint)] uppercase">
          <EnsMark size={12} /> Agent identity (ENS)
        </h2>
        <p className="text-[11.5px] leading-snug text-[var(--color-muted)]">
          No ENS name configured for this deployment, so the agent has no public
          identity yet. See <span className="font-mono">ENS-MANUAL.md</span>.
        </p>
      </section>
    );
  }
  const { profile, resolved } = data;

  return (
    <section className="border-b border-[#1a1a18]/8 px-4 py-3">
      <h2 className="flex items-center gap-1.5 pb-2 text-[11px] tracking-wide text-[var(--color-faint)] uppercase">
        <EnsMark size={12} /> Agent identity (ENS)
      </h2>
      <div className="flex items-center gap-1.5">
        <EnsLink
          name={profile.name}
          parent={profile.name.split(".").slice(1).join(".")}
          className="truncate font-mono text-[13px] text-[var(--color-ink)]"
          mark={false}
        />
        {/*
          Only the positive case gets a badge.

          "pending" was shown whenever forward and reverse resolution disagreed,
          which is the normal state for a crew subname: an address has one
          primary name, so every seat but one reads unverified forever. A
          permanent warning that nobody can clear is noise, and it made a name
          that resolves correctly look broken.
        */}
        {resolved.verified && (
          <span
            title="Forward and reverse resolution agree"
            className="shrink-0 rounded-full bg-emerald-600/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800"
          >
            ✓ verified
          </span>
        )}
      </div>
      <p className="pt-1 text-[11px] text-[var(--color-muted)]">
        Resolves to a full employment record — skills, teachers, owners, brain hash.
      </p>
      <a
        href={`/cv/${encodeURIComponent(profile.name)}?session=${encodeURIComponent(sessionId)}`}
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-block rounded-md border border-[#1a1a18]/20 px-2 py-1 text-[11.5px] hover:bg-white/60"
      >
        View CV ↗
      </a>
      {resolved.dev && (
        <p className="pt-1.5 text-[10px] text-amber-700">
          dev names (no ENS registry configured) — see docs/ENS-TASK.md
        </p>
      )}
    </section>
  );
};
