/**
 * A cited name, resolved live from ENS.
 *
 * The point of this component is what it does NOT do: it does not trust the
 * contributor string we stored alongside the brain chunk. That string is ours,
 * so it proves nothing — we could have written anything. Instead the name is
 * resolved against the network and the provenance shown (tier, sybil band,
 * contributions) comes from ENS text records the crew's own seat published.
 *
 * Turn ENS off and a citation degrades to an unverified name: the claim
 * "(per oleksiy.mass-lisbon.eth's contribution #2)" stops being evidence.
 * That is the difference between ENS as identity layer and ENS as label.
 */

import { useEffect, useState, type FC } from "react";
import { EnsLink } from "./Brand";

interface Resolved {
  name: string;
  address: string | null;
  verified: boolean;
  dev: boolean;
  records: Record<string, string>;
  /** Which network answered: "mainnet" is the seat's own name, "parent" is ours. */
  chain?: "parent" | "mainnet";
  /**
   * The crew subname we issued for this seat, when the cited name is their own.
   * Two names because they assert different things — see below.
   */
  crew?: Resolved;
  error?: string;
}

/** One in-flight request per name, shared by every citation of that name. */
const cache = new Map<string, Promise<Resolved>>();

function resolveName(name: string): Promise<Resolved> {
  const hit = cache.get(name);
  if (hit) return hit;
  const p = fetch(`/api/ens/resolve?name=${encodeURIComponent(name)}&session=cv`)
    .then((r) => r.json() as Promise<Resolved>)
    .catch(
      (e): Resolved => ({
        name,
        address: null,
        verified: false,
        dev: false,
        records: {},
        error: String(e),
      })
    );
  cache.set(name, p);
  return p;
}

const BAND_LABEL: Record<string, string> = {
  low: "low confidence",
  medium: "medium confidence",
  high: "high confidence",
};

export const ResolvedName: FC<{ name: string; children: React.ReactNode }> = ({
  name,
  children,
}) => {
  const [r, setR] = useState<Resolved | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let live = true;
    resolveName(name).then((res) => live && setR(res));
    return () => {
      live = false;
    };
  }, [name]);

  /**
   * Identity comes from the cited name; crew claims come from ours.
   *
   * We cannot write "tier T3, four contributions" onto a name we do not own, so
   * when someone arrives with their own name those records live on the subname
   * we issued them. Reading provenance off the wrong name would either show
   * nothing or, worse, show whatever a stranger chose to publish.
   */
  const provenance = r?.crew ?? r;
  const rec = provenance?.records ?? {};
  const tier = rec["com.mass.tier"];
  const band = rec["com.mass.sybilBand"];
  const count = rec["com.mass.contribCount"];
  const ownName = r?.chain === "mainnet";

  return (
    <span className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className={`citation ${r && !r.verified ? "citation-unverified" : ""}`}
        title={
          r?.verified
            ? "Resolved live from ENS — forward and reverse agree"
            : "This name does not resolve; the claim is unverified"
        }
      >
        {children}
      </button>

      {open && r && (
        <span className="absolute bottom-full left-0 z-20 mb-1 block w-64 rounded-lg border border-[#1a1a18]/15 bg-white p-2.5 font-sans text-[11.5px] leading-snug shadow-lg">
          <EnsLink
            name={r.name}
            parent={r.crew ? undefined : r.name.split(".").slice(1).join(".")}
            className="block font-mono text-[11px] break-all"
            mark={false}
          />

          {r.verified ? (
            <span className="block pt-1 text-emerald-800">
              ✓ resolves live · forward and reverse agree
              {ownName && " · their own name, not ours"}
            </span>
          ) : r.address ? (
            <span className="block pt-1 text-[var(--color-muted)]">
              resolves to an address, but is not their primary name
            </span>
          ) : (
            <span className="block pt-1 text-amber-800">
              ⚠ does not resolve — provenance unverified
            </span>
          )}

          {(tier || band || count) && (
            <span className="mt-1.5 block border-t border-[#1a1a18]/10 pt-1.5 text-[var(--color-muted)]">
              {tier && <span className="block">tier · {tier}</span>}
              {band && <span className="block">uniqueness · {BAND_LABEL[band] ?? band}</span>}
              {count && <span className="block">contributions · {count}</span>}
              {r.crew && (
                <span className="block pt-1 font-mono text-[10.5px] break-all">
                  via{" "}
                  <EnsLink
                    name={r.crew.name}
                    parent={r.crew.name.split(".").slice(1).join(".")}
                    mark={false}
                  />
                </span>
              )}
            </span>
          )}

          {(r.verified || r.address) && !tier && !band && !count && (
            <span className="block pt-1 text-[var(--color-faint)]">
              name resolves, but no provenance records published yet
            </span>
          )}
        </span>
      )}
    </span>
  );
};
