/**
 * Small UI primitives shared by the rail panels.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { SessionView } from "./session";

/**
 * Keeps a button disabled from click until the SERVER has acted.
 *
 * Local handlers return the instant `send()` is called, but the seat, the
 * co-sign or the harvest does not exist until an event comes back. Re-enabling
 * on handler return is why five clicks on "join" produced five seats.
 *
 * Cleared by the next event, by an error, or by a timeout so a dropped response
 * can never wedge a control permanently.
 */
export function usePending(view: SessionView) {
  const [pending, setPending] = useState<string | null>(null);
  const seqAtStart = useRef(-1);

  const start = useCallback(
    (key: string) => {
      seqAtStart.current = view.events.length;
      setPending(key);
    },
    [view.events.length]
  );

  useEffect(() => {
    if (!pending) return;
    if (view.events.length > seqAtStart.current || view.error) setPending(null);
  }, [pending, view.events.length, view.error]);

  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(() => setPending(null), 12_000);
    return () => clearTimeout(t);
  }, [pending]);

  /** Wrap a handler so it marks itself pending and cannot double-fire. */
  const guard = useCallback(
    (key: string, fn: () => void) => () => {
      if (pending) return;
      start(key);
      fn();
    },
    [pending, start]
  );

  /**
   * Clear the latch after a failure that produced no event.
   *
   * The latch normally clears when the server appends something. An action that
   * fails entirely in the browser — a rejected wallet signature, say — never
   * gets that far, so without this every button stays dead for the full 12s
   * timeout and the app looks hung right after telling you what went wrong.
   */
  const cancel = useCallback(() => setPending(null), []);

  return { pending, start, cancel, guard, isPending: (key: string) => pending === key };
}

/**
 * The crew's parent name, read off any subname the session already shows.
 *
 * Derived rather than configured on the client: the server owns the parent, and
 * a second copy in the bundle is a second thing to get out of step. It decides
 * only which ENS app a name links to, so an absent value degrades to the
 * mainnet app rather than breaking anything.
 */
export const crewParent = (view: { agentEnsName?: string }): string | undefined => {
  const n = view.agentEnsName;
  if (!n) return undefined;
  const dot = n.indexOf(".");
  return dot > 0 ? n.slice(dot + 1) : undefined;
};

/** Progressive disclosure: long lists start at 10 and grow on demand. */
export function useVisible(step = 10) {
  const [count, setCount] = useState(step);
  return {
    count,
    more: () => setCount((n) => n + step),
    reset: () => setCount(step),
  };
}

/**
 * HashScan links. Transaction ids arrive as `0.0.1234@1699999999.123456789`
 * from the SDK and `0.0.1234-1699999999-123456789` from Mirror Node; HashScan
 * takes the dashed form.
 */
export const hashscanTx = (id: string) =>
  `https://hashscan.io/testnet/transaction/${id.replace("@", "-").replace(/\.(\d+)$/, "-$1")}`;

/**
 * A consensus timestamp addresses the transaction that carried a topic message,
 * and `/message` opens it decoded — which is the view worth showing a judge.
 */
export const hashscanMessage = (consensusTimestamp: string) =>
  `https://hashscan.io/testnet/transaction/${consensusTimestamp}/message`;
