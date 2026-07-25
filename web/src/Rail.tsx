/**
 * The crew rail: everything that is NOT the conversation. Seats and authority,
 * the contribution composer, cap table, harvest review, and the event ticker
 * (which renders only from MassEvents — MASS-specs M1).
 */

import { useState, type FC } from "react";
import {
  CheckIcon,
  DatabaseIcon,
  ExternalLinkIcon,
  ScrollTextIcon,
  ShieldCheckIcon,
  SproutIcon,
  UsersIcon,
} from "lucide-react";
import { perms, type Intent, type SessionView } from "./session";
import { EnsPanel } from "./Ens";

type VerifyFn = (kind: "selfie" | "agentkit") => Promise<{
  token: string;
  sybilScore?: number;
  dev: boolean;
}>;

/** Tier → label + distinct badge styling, so authority is legible at a glance. */
const TIER: Record<string, { label: string; cls: string }> = {
  T1: { label: "Observer", cls: "bg-[#1a1a18]/8 text-[var(--color-muted)]" },
  T2: { label: "Builder", cls: "bg-sky-600/15 text-sky-800" },
  T3: { label: "Signer", cls: "bg-emerald-600/18 text-emerald-800" },
};

/**
 * Plain-English labels for the visible log. The event NAMES are the schema and
 * never change — this is presentation only, so a reader who has not read the
 * spec can still follow what happened.
 */
const EVENT_LABEL: Record<string, string> = {
  "session.created": "session started",
  "seat.claimed": "seat claimed",
  "seat.left": "left the room",
  "seat.rejoined": "rejoined",
  "verify.selfie.ok": "human verified",
  "verify.agentkit.ok": "approved as signer",
  "verify.continuity.ok": "still at the keyboard",
  "perm.recomputed": "permissions updated",
  instruct: "asked the agent",
  "draft.started": "thinking (quick)",
  "draft.completed": "answered (quick)",
  "canonical.started": "thinking (careful)",
  "canonical.completed": "answered (careful)",
  "contrib.proposed": "taught something",
  "contrib.challenged": "challenged",
  "contrib.screened": "safety-checked",
  "contrib.cosigned": "approved by a signer",
  "contrib.accepted": "added to the brain",
  "brain.updated": "brain saved",
  "archive.written": "session archived",
  "payment.executed": "payment sent",
  "hcs.anchored": "recorded on Hedera",
  "harvest.opened": "review opened",
  "harvest.closed": "review finished",
  "harvest.cancelled": "review cancelled",
  "session.closed": "session closed",
  "captable.minted": "ownership minted",
  payout: "crew paid",
};

const labelFor = (type: string) => EVENT_LABEL[type] ?? type;

/**
 * The events that are ever submitted to HCS — mirrors ANCHORED in
 * src/hedera/client.ts. Only these can be "awaiting consensus"; comparing the
 * whole event count against the topic made the panel claim a permanent, growing
 * backlog that could never clear.
 */
const ANCHORED = new Set([
  "seat.claimed",
  "contrib.cosigned",
  "contrib.accepted",
  "brain.updated",
  "payment.executed",
  "job.settled",
  "captable.minted",
  "payout",
]);
import { HederaPanel } from "./Hedera";
import { hashscanTx, usePending, useVisible } from "./ui";

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

export const Rail: FC<{
  view: SessionView;
  send: (i: Intent) => void;
  verify: VerifyFn;
  verifying: boolean;
}> = ({ view, send, verify, verifying }) => {
  const [name, setName] = useState("");
  const [copied, setCopied] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [delegating, setDelegating] = useState(false);
  const act = usePending(view);
  const logShown = useVisible(10);
  const sessionId = new URLSearchParams(location.search).get("session") ?? "default";
  const seats = Object.values(view.seats);
  const seated = !!view.you;
  const me = view.you ? view.seats[view.you] : undefined;
  const p = perms(view);
  const pending = Object.values(view.contributions).filter((c) => c.state === "proposed");
  const accepted = Object.values(view.contributions).filter((c) => c.state === "accepted");
  /** Something has actually been kept in the open review — otherwise approving errors. */
  const keptAny = pending.some((c) => c.state === "proposed");
  const anchorableCount = view.events.filter((e) => ANCHORED.has(e.type)).length;

  // Ownership as a share, not a raw count: "1" means nothing to a reader, "100%"
  // is the number the product is actually about. (Interim proxy until the full
  // authorship + usage formula is wired.)
  const totalContributions = Object.values(view.capTable).reduce((a, b) => a + b, 0);
  const owners = Object.entries(view.capTable)
    .map(([seat, n]) => ({
      seat,
      n,
      name: view.seats[seat]?.name ?? seat,
      ensName: view.seats[seat]?.ensName,
      pct: totalContributions > 0 ? Math.round((n / totalContributions) * 100) : 0,
    }))
    .sort((a, b) => b.pct - a.pct || b.n - a.n);

  // Seat claim requires a SERVER-verified Selfie Check; the token is issued only
  // after /api/verify/selfie succeeds. See web/src/world.tsx.
  const claim = async () => {
    // `verifying` only covers the World round-trip; the seat does not exist
    // until the server emits seat.claimed. Without act.start() the button
    // re-enabled in between, and five clicks made five seats.
    if (!name.trim() || verifying || act.pending) return;
    setAuthError(null);
    act.start("claim");
    try {
      const r = await verify("selfie");
      send({ kind: "claimSeat", name: name.trim(), selfieToken: r.token });
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Selfie Check failed");
    }
  };

  // Become a Signer: Orb / AgentKit delegation to the session agent.
  const delegate = async () => {
    if (verifying || delegating || act.pending) return;
    setDelegating(true);
    act.start("delegate");
    setAuthError(null);
    try {
      const r = await verify("agentkit");
      send({ kind: "delegate", agentkitToken: r.token });
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Orb verification failed");
    } finally {
      setDelegating(false);
    }
  };

  return (
    <aside className="flex h-full w-[340px] shrink-0 flex-col overflow-y-auto border-l border-[#1a1a18]/10 bg-[#e9e4d6] font-sans text-[13px] text-[var(--color-ink)]">
      {/*
        Sessions are keyed by ?session=. Two people on different keys are in
        different rooms and each thinks the other is silent, which is exactly
        what happened in testing. Show the room and hand out its link.
      */}
      <div className="border-b border-[#1a1a18]/8 bg-[#1a1a18]/4 px-4 py-2">
        <div className="flex items-center justify-between">
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
        <button
          onClick={act.guard("newSession", () => {
            const id = Math.random().toString(36).slice(2, 8);
            location.href = `${location.pathname}?session=${id}`;
          })}
          disabled={!!act.pending}
          className="mt-2 w-full rounded-md border border-[#1a1a18]/20 py-1.5 text-[11.5px] hover:bg-white/60 disabled:opacity-40"
        >
          {act.isPending("newSession") ? "Starting…" : "Start a new session"}
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
              onKeyDown={(e) => e.key === "Enter" && claim()}
              placeholder="your name"
              disabled={verifying}
              className="min-w-0 flex-1 rounded-md border border-[#1a1a18]/15 bg-white/70 px-2 py-1.5 outline-none disabled:opacity-50"
            />
            <button
              onClick={claim}
              disabled={!name.trim() || verifying || !!act.pending}
              className="rounded-md bg-[var(--color-ink)] px-3 py-1.5 text-[var(--color-cream)] hover:opacity-85 disabled:opacity-40"
            >
              {verifying ? "Verifying…" : act.isPending("claim") ? "Joining…" : "Verify & join"}
            </button>
          </div>
          <p className="pt-1.5 text-[11px] leading-snug text-[var(--color-muted)]">
            A World <strong>Selfie Check</strong> proves you’re a unique human before
            you can build — it’s what makes each ownership share sybil-proof.
          </p>
          {authError && <p className="pt-1 text-[11px] text-red-700">{authError}</p>}
        </div>
      )}

      <Section icon={<UsersIcon size={12} />} title={`Crew (${seats.length})`}>
        <ul className="space-y-1.5">
          {seats.map((s) => {
            const t = TIER[s.tier] ?? TIER.T1;
            return (
              <li
                key={s.seat}
                className={`flex items-center justify-between ${s.present ? "" : "opacity-45"}`}
              >
                <span className="min-w-0">
                  <span className={s.seat === view.you ? "font-semibold" : ""}>
                    {s.name}
                    {s.seat === view.you && " (you)"}
                    {!s.present && <span className="text-[10px] text-[var(--color-faint)]"> · away</span>}
                  </span>
                  {s.ensName && (
                    <span className="block truncate font-mono text-[10px] text-[var(--color-muted)]">
                      {s.ensName}
                    </span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {s.sybilScore !== undefined && (
                    <span
                      title="How confident we are this is one real person. Low scores get watch-only access."
                      className="rounded-full bg-[#1a1a18]/6 px-1.5 py-0.5 text-[10px] tabular-nums text-[var(--color-muted)]"
                    >
                      Sybil {s.sybilScore.toFixed(2)}
                    </span>
                  )}
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${t.cls}`}>
                    {t.label}
                  </span>
                </span>
              </li>
            );
          })}
          {seats.length === 0 && <li className="text-[var(--color-faint)]">nobody yet</li>}
        </ul>

        {/* Live quorum readout — the authority co-signing depends on (recomputes
            the instant a signer joins or leaves). */}
        {seated && (
          <p className="pt-2 text-[11px] text-[var(--color-muted)]">
            {p.presentT3}/2 signers present · commit actions{" "}
            <span className={p.canCommit ? "text-emerald-800" : "text-amber-800"}>
              {p.canCommit ? "unlocked" : "locked"}
            </span>
          </p>
        )}

        {/* Observer: a verified human whose sybil score is below threshold. */}
        {me?.tier === "T1" && (
          <p className="pt-1.5 text-[11px] leading-snug text-amber-800">
            You’re an <strong>Observer</strong>
            {me.sybilScore !== undefined ? ` (sybil ${me.sybilScore.toFixed(2)}, below threshold)` : ""}:
            you can watch, but not propose, co-sign, or earn equity.
          </p>
        )}

        {/* Builder → Signer via Orb / AgentKit delegation to the session agent. */}
        {me?.tier === "T2" && (
          <button
            onClick={delegate}
            disabled={verifying || delegating}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-emerald-700/30 bg-emerald-600/10 py-1.5 text-[12px] text-emerald-900 hover:bg-emerald-600/15 disabled:opacity-40"
          >
            <ShieldCheckIcon size={13} />
            {delegating ? "Verifying with Orb…" : "Become a Signer (Orb)"}
          </button>
        )}
        {authError && seated && <p className="pt-1 text-[11px] text-red-700">{authError}</p>}
      </Section>

      <EnsPanel sessionId={sessionId} closed={view.closed} />

      <Section icon={<SproutIcon size={12} />} title="Waiting for approval">
        {pending.length === 0 && (
          <p className="text-[11.5px] leading-snug text-[var(--color-muted)]">
            Nothing proposed yet. Use <em>Teach this</em> under any message you
            sent, or harvest the conversation below.
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
                      {c.cosigners.length < 2 &&
                        (p.presentT3 < 2
                          ? " — needs 2 signers present"
                          : mine
                            ? " — needs another signer"
                            : "")}
                    </span>
                    <button
                      onClick={act.guard(`cosign:${c.contribId}`, () =>
                        send({ kind: "cosign", contribId: c.contribId })
                      )}
                      disabled={me?.tier !== "T3" || !!mine || !!act.pending}
                      title={me?.tier === "T3" ? undefined : "Only Signers (Orb-verified) can co-sign"}
                      className="rounded bg-[var(--color-accent)] px-2 py-1 text-[11px] text-white hover:opacity-85 disabled:opacity-30"
                    >
                      {mine ? "signed" : me?.tier === "T3" ? "Co-sign" : "Signers only"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section icon={<DatabaseIcon size={12} />} title="Who owns this agent">
        {totalContributions === 0 ? (
          <p className="text-[11.5px] leading-snug text-[var(--color-muted)]">
            Nobody owns it yet. Teach it something.
          </p>
        ) : (
          <>
            <p className="pb-1.5 text-[var(--color-muted)]">
              {accepted.length} thing{accepted.length === 1 ? "" : "s"} taught so far
            </p>
            <ul className="space-y-1 pb-2">
              {owners.map((o) => (
                <li key={o.seat} className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate">
                    {o.name}
                    {/* The ENS subname disambiguates: two people can pick the
                        same display name, and this is the one number that must
                        never be ambiguous. */}
                    {o.ensName && (
                      <span className="block truncate font-mono text-[10px] text-[var(--color-faint)]">
                        {o.ensName}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    <strong>{o.pct}%</strong>
                    <span className="text-[var(--color-muted)]">
                      {" "}
                      · {o.n} contribution{o.n === 1 ? "" : "s"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
        {view.brainPending && <p className="text-[11px] text-amber-700">saving the brain…</p>}
        {view.brainRoot && (
          <p className="text-[11px] text-[var(--color-muted)]">
            <span
              className="rounded-full bg-emerald-600/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800"
              title={`The agent's brain is stored on 0G and fingerprinted, so any change is detectable.\nContent hash: ${view.brainRoot}`}
            >
              ✓ brain verified
            </span>
          </p>
        )}
      </Section>

      <Section icon={<CheckIcon size={12} />} title="Review what we said">
        {!view.harvestOpen ? (
          <>
            <p className="pb-2 text-[11.5px] leading-snug text-[var(--color-muted)]">
              Just talk to the agent normally. Then review it together and keep what is worth remembering.
            </p>
            <button
              onClick={act.guard("harvest", () => send({ kind: "openHarvest" }))}
              disabled={!seated || view.closed}
              className="w-full rounded-md border border-[#1a1a18]/20 py-1.5 hover:bg-white/50 disabled:opacity-30"
            >
              Review what we said
            </button>
          </>
        ) : (
          <>
            <p className="pb-2 text-[11.5px] leading-snug text-[var(--color-muted)]">
              What looks worth teaching. <strong>Keep</strong> puts a line forward;
              it only counts once two signers approve it together. Missed
              something? Use <em>Teach this</em> on the message itself.
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
                <li className="text-[var(--color-faint)]">
                  nothing new said since the last harvest
                </li>
              )}
            </ul>
            <div className="flex gap-2 pt-2">
              {/* Offering an action whose only possible outcome is an error
                  reads as a broken app: nothing kept, or not a signer, means
                  the server would reject this. Say why instead. */}
              <button
                onClick={act.guard("cosignBatch", () =>
                  send({ kind: "cosignBatch", harvestId: view.harvestId })
                )}
                disabled={!!act.pending || !keptAny || me?.tier !== "T3"}
                title={
                  !keptAny
                    ? "Keep at least one line first"
                    : me?.tier !== "T3"
                      ? "Only signers can approve"
                      : undefined
                }
                className="flex-1 rounded-md bg-[var(--color-accent)] py-1.5 text-white hover:opacity-85 disabled:opacity-30"
              >
                Approve together
              </button>
              <button
                onClick={act.guard("cancelHarvest", () =>
                  send({ kind: "cancelHarvest", harvestId: view.harvestId })
                )}
                disabled={!!act.pending}
                className="rounded-md border border-[#1a1a18]/20 px-2 hover:bg-white/50"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </Section>

      <HederaPanel eventCount={view.events.length} anchorable={anchorableCount} />

      <Section icon={<ScrollTextIcon size={12} />} title={`Log (${view.events.length})`}>
        <ol className="space-y-0.5 font-mono text-[10.5px] text-[var(--color-muted)]">
          {[...view.events].reverse().slice(0, logShown.count).map((e) => (
            <li key={e.id}>
              {/* Only rows that actually carry a transaction become links —
                  a link that goes nowhere is worse than no link. */}
              {(() => {
                const txId = (e.payload as { hederaTxId?: string } | undefined)?.hederaTxId;
                const body = (
                  <>
                    <span className="truncate">
                      <span className="text-[var(--color-faint)]">#{e.seq}</span>{" "}
                    {labelFor(e.type)}
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-[var(--color-faint)]">
                      {e.payloadHash?.slice(0, 8)}
                      {txId && <ExternalLinkIcon size={9} />}
                    </span>
                  </>
                );
                const title = `payloadHash ${e.payloadHash ?? "-"}\n${JSON.stringify(e.payload)}`;
                return txId ? (
                  <a
                    href={hashscanTx(txId)}
                    target="_blank"
                    rel="noreferrer"
                    title={title}
                    className="-mx-1 flex justify-between gap-2 rounded px-1 hover:bg-white/60"
                  >
                    {body}
                  </a>
                ) : (
                  <span className="flex justify-between gap-2" title={title}>{body}</span>
                );
              })()}
            </li>
          ))}
        </ol>
        {view.events.length > logShown.count && (
          <button
            onClick={logShown.more}
            className="mt-1.5 w-full rounded-md border border-[#1a1a18]/15 py-1 font-sans text-[11px] hover:bg-white/60"
          >
            Show 10 more ({view.events.length - logShown.count} left)
          </button>
        )}
      </Section>

      <div className="mt-auto px-4 py-3">
        {view.closed ? (
          <p className="text-center text-[11.5px] text-[var(--color-muted)]">
            Session closed. Start a new one from the top of this panel.
          </p>
        ) : (
          <>
            <button
              onClick={act.guard("close", () => send({ kind: "closeSession" }))}
              disabled={!seated || view.harvestOpen || !!act.pending}
              className="w-full rounded-md border border-[#1a1a18]/25 py-1.5 hover:bg-white/50 disabled:opacity-30"
            >
              Close session — The Birth
            </button>
            {/* A disabled control with no stated reason reads as a broken app. */}
            {(!seated || view.harvestOpen) && (
              <p className="pt-1 text-center text-[11px] text-[var(--color-muted)]">
                {!seated
                  ? "claim a seat first"
                  : "reviewing above — the session closes itself when you finish"}
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
