/**
 * The public CV page (M5, ENS-TASK Req 4).
 *
 * A read-only employment record for an agent, rendered entirely from ENS
 * resolution + the session's own artifacts — no session, no wallet, no hex.
 * Reachable at /cv/<name>; the agent's ENS `url` record points here.
 */

import { useEffect, useState } from "react";

interface Owner {
  name: string;
  contributions: number;
  shareBps: number;
}

interface Profile {
  name: string;
  role: string;
  description: string;
  skills: string[];
  session: string;
  availability: "for-hire" | "in-session";
  brainRoot?: string;
  archiveRoot?: string;
  hcsTopic?: string;
  capTableToken?: string;
  owners: Owner[];
  contributionCount: number;
  crewSize: number;
}

interface CvResponse {
  profile: Profile;
  records: Record<string, string>;
  resolved: { verified: boolean; dev: boolean; error?: string };
}

const pct = (bps: number) => `${(bps / 100).toFixed(1)}%`;

export function Cv({ name }: { name: string }) {
  const [data, setData] = useState<CvResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // The record belongs to the room the agent was built in. Without carrying
    // the session through, every CV rendered whichever agent happened to live in
    // the "default" room.
    const session = new URLSearchParams(location.search).get("session");
    const qs = new URLSearchParams({ name });
    if (session) qs.set("session", session);
    fetch(`/api/ens/cv?${qs}`)
      .then((r) => r.json())
      .then(setData)
      .catch((e) => setError(String(e)));
  }, [name]);

  if (error) return <Shell><p className="text-red-700">Could not load {name}: {error}</p></Shell>;
  if (!data) return <Shell><p className="text-[var(--color-muted)]">Resolving {name}…</p></Shell>;

  const { profile: p, resolved } = data;

  return (
    <Shell>
      <header className="border-b border-[#1a1a18]/10 pb-5">
        <div className="flex items-center gap-2">
          <h1 className="font-mono text-[22px] font-semibold text-[var(--color-ink)]">{p.name}</h1>
          <span
            title={resolved.verified ? "Forward and reverse resolution agree" : "Name not verified"}
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              resolved.verified
                ? "bg-emerald-600/15 text-emerald-800"
                : "bg-amber-500/15 text-amber-800"
            }`}
          >
            {resolved.verified ? "✓ verified name" : "⚠ unverified"}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              p.availability === "for-hire"
                ? "bg-sky-600/15 text-sky-800"
                : "bg-[#1a1a18]/8 text-[var(--color-muted)]"
            }`}
          >
            {p.availability === "for-hire" ? "for hire" : "in session"}
          </span>
        </div>
        <p className="pt-1 text-[15px] text-[var(--color-ink)]">{p.role}</p>
        <p className="pt-1 text-[13px] leading-relaxed text-[var(--color-muted)]">{p.description}</p>
        {resolved.dev && (
          <p className="pt-2 text-[11px] text-amber-700">
            DEV MODE — names are deterministic placeholders (no ENS registry configured).
          </p>
        )}
      </header>

      <Field label="Skills">
        <div className="flex flex-wrap gap-1.5">
          {p.skills.map((s) => (
            <span key={s} className="rounded-full bg-[#1a1a18]/6 px-2 py-0.5 text-[12px]">{s}</span>
          ))}
        </div>
      </Field>

      <Field label={`Taught by · ${p.crewSize} verified humans · ${p.contributionCount} contributions`}>
        {p.owners.length === 0 ? (
          <p className="text-[13px] text-[var(--color-faint)]">No accepted contributions yet.</p>
        ) : (
          <ul className="space-y-1">
            {p.owners.map((o) => (
              <li key={o.name} className="flex items-center justify-between text-[13px]">
                <span className="font-mono">{o.name}</span>
                <span className="tabular-nums text-[var(--color-muted)]">
                  {o.contributions} taught · {pct(o.shareBps)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Field>

      <Field label="Provenance & assets">
        <dl className="space-y-1.5 text-[12.5px]">
          <Row k="Brain (0G Storage root)" v={p.brainRoot} mono />
          <Row k="Session archive (0G)" v={p.archiveRoot} mono />
          <Row k="Audit log (Hedera HCS topic)" v={p.hcsTopic} mono />
          <Row k="Cap table (Hedera HTS token)" v={p.capTableToken} mono />
          <Row k="Session" v={p.session} mono />
        </dl>
      </Field>

      <footer className="border-t border-[#1a1a18]/10 pt-4 text-[11px] text-[var(--color-faint)]">
        Resolved from ENS · built with MASS — verified humans, on the record.
      </footer>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full bg-[#f3efe4] font-sans text-[var(--color-ink)]">
      <div className="mx-auto max-w-[640px] space-y-6 px-6 py-12">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="pb-2 text-[11px] tracking-wide text-[var(--color-faint)] uppercase">{label}</h2>
      {children}
    </section>
  );
}

function Row({ k, v, mono }: { k: string; v?: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-[var(--color-muted)]">{k}</dt>
      <dd className={`text-right break-all ${mono ? "font-mono text-[11px]" : ""} ${v ? "" : "text-[var(--color-faint)]"}`}>
        {v ?? "—"}
      </dd>
    </div>
  );
}
