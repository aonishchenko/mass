/**
 * The crew rail: everything that is NOT the conversation. Seats and authority,
 * the contribution composer, cap table, harvest review, and the event ticker
 * (which renders only from MassEvents — MASS-specs M1).
 */

import { useState, type FC } from "react";
import { CheckIcon, DatabaseIcon, ScrollTextIcon, SproutIcon, UsersIcon } from "lucide-react";
import type { Intent, SessionView } from "./session";

const Section: FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({
  icon,
  title,
  children,
}) => (
  <section className="border-b border-[#1a1a18]/8 px-4 py-3">
    <h2 className="flex items-center gap-1.5 pb-2 text-[11px] tracking-wide text-[var(--color-faint)] uppercase">
      {icon} {title}
    </h2>
    {children}
  </section>
);

const tierLabel: Record<string, string> = {
  T1: "Observer",
  T2: "Builder",
  T3: "Signer",
};

export const Rail: FC<{ view: SessionView; send: (i: Intent) => void }> = ({ view, send }) => {
  const [name, setName] = useState("");
  const [copied, setCopied] = useState(false);
  const sessionId = new URLSearchParams(location.search).get("session") ?? "default";
  const seats = Object.values(view.seats);
  const seated = !!view.you;
  const pending = Object.values(view.contributions).filter((c) => c.state === "proposed");
  const accepted = Object.values(view.contributions).filter((c) => c.state === "accepted");

  return (
    <aside className="flex h-full w-[340px] shrink-0 flex-col overflow-y-auto border-l border-[#1a1a18]/10 bg-[#e9e4d6] font-sans text-[13px] text-[var(--color-ink)]">
      {/*
        Sessions are keyed by ?session=. Two people on different keys are in
        different rooms and each thinks the other is silent, which is exactly
        what happened in testing. Show the room and hand out its link.
      */}
      <div className="flex items-center justify-between border-b border-[#1a1a18]/8 bg-[#1a1a18]/4 px-4 py-2">
        <span className="truncate text-[11px] text-[var(--color-muted)]">
          room <span className="font-mono text-[var(--color-ink)]">{sessionId}</span>
        </span>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(location.href);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="shrink-0 rounded-md border border-[#1a1a18]/20 px-2 py-1 text-[11px] hover:bg-white/60"
        >
          {copied ? "copied ✓" : "Copy invite link"}
        </button>
      </div>

      {!seated && (
        <div className="border-b border-[#1a1a18]/8 px-4 py-3">
          <label className="text-[11px] tracking-wide text-[var(--color-faint)] uppercase">
            Claim your seat
          </label>
          <div className="flex gap-2 pt-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && name.trim() && send({ kind: "claimSeat", name })}
              placeholder="your name"
              className="min-w-0 flex-1 rounded-md border border-[#1a1a18]/15 bg-white/70 px-2 py-1.5 outline-none"
            />
            <button
              onClick={() => name.trim() && send({ kind: "claimSeat", name })}
              className="rounded-md bg-[var(--color-ink)] px-3 py-1.5 text-[var(--color-cream)] hover:opacity-85"
            >
              Join
            </button>
          </div>
        </div>
      )}

      <Section icon={<UsersIcon size={12} />} title={`Crew (${seats.length})`}>
        <ul className="space-y-1.5">
          {seats.map((s) => (
            <li key={s.seat} className="flex items-center justify-between">
              <span className={s.seat === view.you ? "font-semibold" : ""}>
                {s.name}
                {s.seat === view.you && " (you)"}
              </span>
              <span className="flex items-center gap-1.5">
                {s.sybilScore !== undefined && (
                  <span
                    title="World sybil score"
                    className="rounded-full bg-emerald-600/12 px-1.5 py-0.5 text-[10px] text-emerald-800"
                  >
                    ✓ {s.sybilScore}
                  </span>
                )}
                <span className="text-[11px] text-[var(--color-muted)]">{tierLabel[s.tier]}</span>
              </span>
            </li>
          ))}
          {seats.length === 0 && <li className="text-[var(--color-faint)]">nobody yet</li>}
        </ul>
      </Section>

      <Section icon={<SproutIcon size={12} />} title="Awaiting co-sign">
        {pending.length === 0 && (
          <p className="text-[11.5px] leading-snug text-[var(--color-muted)]">
            Nothing proposed yet. Hover any message you sent and choose{" "}
            <em>Teach this</em>, or harvest the whole conversation below.
          </p>
        )}

        {pending.length > 0 && (
          <ul className="space-y-2">
            {pending.map((c) => {
              const mine = view.you && c.cosigners.includes(view.you);
              return (
                <li key={c.contribId} className="rounded-md border border-[#1a1a18]/12 bg-white/50 p-2">
                  <p className="text-[12px] leading-snug">{c.text}</p>
                  <div className="flex items-center justify-between pt-1.5">
                    <span className="text-[11px] text-[var(--color-faint)]">
                      {c.cosigners.length}/2 co-signed
                      {mine && c.cosigners.length < 2 && " — needs another seat"}
                    </span>
                    <button
                      onClick={() => send({ kind: "cosign", contribId: c.contribId })}
                      disabled={!seated || !!mine}
                      className="rounded bg-[var(--color-accent)] px-2 py-1 text-[11px] text-white hover:opacity-85 disabled:opacity-30"
                    >
                      {mine ? "signed" : "Co-sign"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section icon={<DatabaseIcon size={12} />} title="Brain & cap table">
        <p className="pb-1 text-[var(--color-muted)]">
          {accepted.length} accepted contribution{accepted.length === 1 ? "" : "s"}
        </p>
        <ul className="space-y-0.5 pb-2">
          {Object.entries(view.capTable).map(([seat, n]) => (
            <li key={seat} className="flex justify-between">
              <span>{view.seats[seat]?.name ?? seat}</span>
              <span className="tabular-nums text-[var(--color-muted)]">{n}</span>
            </li>
          ))}
        </ul>
        {view.brainPending && <p className="text-[11px] text-amber-700">writing to 0G Storage…</p>}
        {view.brainRoot && (
          <p className="font-mono text-[10px] break-all text-[var(--color-muted)]">
            brain root {view.brainRoot.slice(0, 18)}…
          </p>
        )}
      </Section>

      <Section icon={<CheckIcon size={12} />} title="Harvest">
        {!view.harvestOpen ? (
          <>
            <p className="pb-2 text-[11.5px] leading-snug text-[var(--color-muted)]">
              Just talk to the agent normally. Harvest pulls the teachable moments
              out of the conversation so you don't have to flag them as you go.
            </p>
            <button
              onClick={() => send({ kind: "openHarvest" })}
              disabled={!seated || view.closed}
              className="w-full rounded-md border border-[#1a1a18]/20 py-1.5 hover:bg-white/50 disabled:opacity-30"
            >
              Find teachable moments
            </button>
          </>
        ) : (
          <>
            <p className="pb-2 text-[11.5px] leading-snug text-[var(--color-muted)]">
              Everything you said, suggestions first. <strong>Keep</strong> proposes
              a line for the brain; it only counts once two signers co-sign the
              batch below.
            </p>
            <ul className="space-y-1.5">
              {[...view.candidates]
                .sort((a, b) => Number(b.suggested) - Number(a.suggested))
                .map((c) => (
                  <li
                    key={c.candidateId}
                    className={`rounded-md border p-2 ${
                      c.suggested
                        ? "border-[var(--color-accent)]/40 bg-[var(--color-accent)]/8"
                        : "border-[#1a1a18]/12 bg-white/40"
                    }`}
                  >
                    <p className="text-[12px] leading-snug">{c.text}</p>
                    {c.original && (
                      <p className="pt-0.5 text-[10.5px] text-[var(--color-faint)] italic">
                        you said: “{c.original}”
                      </p>
                    )}
                    <div className="flex items-center justify-between pt-1">
                      {c.suggested ? (
                        <span className="text-[10px] tracking-wide text-[var(--color-accent)] uppercase">
                          suggested
                        </span>
                      ) : (
                        <span />
                      )}
                      <button
                        onClick={() =>
                          send({
                            kind: "keepCandidate",
                            harvestId: view.harvestId,
                            candidateId: c.candidateId,
                            text: c.text,
                          })
                        }
                        className="rounded bg-[var(--color-ink)] px-2 py-0.5 text-[11px] text-[var(--color-cream)] hover:opacity-85"
                        title="Propose this line for the agent's brain"
                      >
                        Keep →
                      </button>
                    </div>
                  </li>
                ))}
              {view.candidates.length === 0 && (
                <li className="text-[var(--color-faint)]">nothing said yet to review</li>
              )}
            </ul>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => send({ kind: "cosignBatch", harvestId: view.harvestId })}
                className="flex-1 rounded-md bg-[var(--color-accent)] py-1.5 text-white hover:opacity-85"
              >
                Co-sign batch
              </button>
              <button
                onClick={() => send({ kind: "cancelHarvest", harvestId: view.harvestId })}
                className="rounded-md border border-[#1a1a18]/20 px-2 hover:bg-white/50"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </Section>

      <Section icon={<ScrollTextIcon size={12} />} title={`Log (${view.events.length})`}>
        <ol className="space-y-0.5 font-mono text-[10.5px] text-[var(--color-muted)]">
          {[...view.events].reverse().slice(0, 40).map((e) => (
            <li key={e.id} className="truncate" title={JSON.stringify(e.payload)}>
              <span className="text-[var(--color-faint)]">#{e.seq}</span> {e.type}
            </li>
          ))}
        </ol>
      </Section>

      <div className="mt-auto px-4 py-3">
        {view.closed ? (
          <button
            onClick={() => {
              const id = Math.random().toString(36).slice(2, 8);
              location.href = `${location.pathname}?session=${id}`;
            }}
            className="w-full rounded-md bg-[var(--color-ink)] py-1.5 text-[var(--color-cream)] hover:opacity-85"
          >
            Start a new session
          </button>
        ) : (
          <>
            <button
              onClick={() => send({ kind: "closeSession" })}
              disabled={!seated || view.harvestOpen}
              className="w-full rounded-md border border-[#1a1a18]/25 py-1.5 hover:bg-white/50 disabled:opacity-30"
            >
              Close session — The Birth
            </button>
            {/* A disabled control with no stated reason reads as a broken app. */}
            {(!seated || view.harvestOpen) && (
              <p className="pt-1 text-center text-[11px] text-[var(--color-muted)]">
                {!seated
                  ? "claim a seat first"
                  : "finish or cancel the harvest above first"}
              </p>
            )}
          </>
        )}
        {view.archiveRoot && (
          <p className="pt-1.5 font-mono text-[10px] break-all text-[var(--color-muted)]">
            archive {view.archiveRoot.slice(0, 18)}…
          </p>
        )}
      </div>
    </aside>
  );
};
