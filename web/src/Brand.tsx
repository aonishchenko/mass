/**
 * The four chain marks, as inline SVG.
 *
 * Inline rather than image files so they inherit size from where they sit and
 * never cost a request — these appear next to buttons and section headings that
 * render before anything has loaded.
 *
 * Hedera and ENS are the official logo paths. World and 0G are drawn to their
 * marks' geometry, because neither publishes a redistributable SVG: they are
 * recognisable, not official assets, and should not be presented as such.
 *
 * They are here to say WHICH chain does the work behind a control — a Hedera
 * mark on "Run a job" means that button moves HBAR — so they go on things that
 * genuinely touch that chain and nowhere else. A logo on a button that talks to
 * nothing is decoration pretending to be provenance.
 */

import type { FC } from "react";

interface MarkProps {
  size?: number;
  className?: string;
  /** Rendered as the mark's tooltip. Defaults name the chain and its job. */
  title?: string;
}

const wrap = (title: string, size: number, className: string | undefined, body: React.ReactNode) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    className={`inline-block shrink-0 align-[-0.14em] ${className ?? ""}`}
    role="img"
    aria-label={title}
  >
    <title>{title}</title>
    {body}
  </svg>
);

export const HederaMark: FC<MarkProps> = ({ size = 13, className, title }) =>
  wrap(
    title ?? "Hedera — anchored to the public ledger",
    size,
    className,
    <g transform="scale(0.0096)">
      <path
        d="M1250,0C559.64,0,0,559.64,0,1250S559.64,2500,1250,2500s1250-559.64,1250-1250S1940.36,0,1250,0"
        fill="currentColor"
      />
      <path
        d="M1758.12,1790.62H1599.38V1453.13H900.62v337.49H741.87V696.25H900.62v329.37h698.76V696.25h158.75Zm-850-463.75h698.75V1152.5H908.12Z"
        fill="var(--color-cream, #fff)"
      />
    </g>
  );

export const EnsMark: FC<MarkProps> = ({ size = 13, className, title }) =>
  wrap(
    title ?? "ENS — resolved live, not asserted by us",
    size,
    className,
    <path
      fill="#0080BC"
      d="M11.725.223 5.107 11.13a.146.146 0 0 1-.237.018c-.583-.692-2.753-3.64-.067-6.327 2.45-2.452 5.572-4.2 6.73-4.804.13-.068.269.08.192.206m-.366 23.747c.132.093.295-.064.206-.2-1.478-2.251-6.392-9.744-7.07-10.869-.67-1.11-1.987-2.953-2.097-4.53-.011-.158-.228-.19-.283-.042a10 10 0 0 0-.27.85c-1.105 4.11.5 8.472 3.985 10.916zm.909-.193 6.618-10.907a.146.146 0 0 1 .237-.018c.582.692 2.753 3.64.067 6.327-2.45 2.452-5.572 4.2-6.73 4.804-.13.068-.269-.08-.192-.206M12.641.028c-.132-.093-.295.065-.206.2 1.478 2.252 6.392 9.745 7.07 10.87.67 1.109 1.987 2.952 2.097 4.53.011.157.228.19.283.041.088-.239.182-.524.27-.85 1.105-4.11-.5-8.472-3.985-10.915z"
    />
  );

export const WorldMark: FC<MarkProps> = ({ size = 13, className, title }) =>
  wrap(
    title ?? "World — proof that you are one unique human",
    size,
    className,
    <>
      <circle cx="12" cy="12" r="11" fill="currentColor" />
      <circle
        cx="12"
        cy="12"
        r="6.6"
        fill="none"
        stroke="var(--color-cream, #fff)"
        strokeWidth="1.9"
      />
      <ellipse
        cx="12"
        cy="12"
        rx="2.9"
        ry="6.6"
        fill="none"
        stroke="var(--color-cream, #fff)"
        strokeWidth="1.9"
      />
    </>
  );

export const ZgMark: FC<MarkProps> = ({ size = 13, className, title }) =>
  wrap(
    title ?? "0G — the model runs here, and the archive lives here",
    size,
    className,
    <>
      <rect x="0" y="0" width="24" height="24" rx="6.2" fill="currentColor" />
      <text
        x="12"
        y="16.6"
        textAnchor="middle"
        fontSize="11"
        fontWeight="800"
        fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
        fill="var(--color-cream, #fff)"
      >
        0G
      </text>
    </>
  );

/**
 * An ENS name, clickable through to where it can be checked.
 *
 * The point of showing a name rather than an address is that a stranger can
 * verify it. That only holds if the name is one click from the registry, so
 * every name we render is a link.
 *
 * Two apps, because our names live on the v2 beta on Sepolia and a crew
 * member's own name lives on mainnet. Routed by suffix: anything under the
 * crew's parent is ours, everything else is theirs — the same rule the server
 * uses to pick a chain in `homeChainFor`.
 */
export const ensAppUrl = (name: string, parent?: string): string =>
  parent && (name === parent || name.endsWith(`.${parent}`))
    ? `https://app.ens.dev/${name}`
    : `https://app.ens.domains/${name}`;

export const EnsLink: FC<{
  name: string;
  parent?: string;
  className?: string;
  children?: React.ReactNode;
  /** Hide the mark where one already sits beside the name. */
  mark?: boolean;
}> = ({ name, parent, className, children, mark = true }) => (
  <a
    href={ensAppUrl(name, parent)}
    target="_blank"
    rel="noreferrer"
    title={`${name} — open in the ENS app to check it yourself`}
    className={`inline-flex items-center gap-1 hover:underline ${className ?? ""}`}
  >
    {mark && <EnsMark size={11} />}
    {children ?? name}
  </a>
);
