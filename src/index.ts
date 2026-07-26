/**
 * Worker entry. Routes WebSocket upgrades to the session's Durable Object and
 * serves the built assistant-ui app for everything else.
 */

import { SessionRoom, type Env } from "./session-do.js";
import {
  accountBalance,
  hashscan,
  readTopicMessages,
  topicMessageCount,
} from "./hedera/mirror.js";

export { SessionRoom };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    /**
     * The ticker source — hedera-spec §4.3. This runs in the Worker against
     * Mirror Node REST, so what the UI shows is what the network returned, not
     * what we believe we sent.
     */
    if (url.pathname === "/api/hcs") {
      if (!env.HEDERA_TOPIC_ID) {
        return Response.json({ configured: false, messages: [] });
      }
      try {
        const messages = await readTopicMessages(env.HEDERA_TOPIC_ID, 50);
        return Response.json({
          configured: true,
          topicId: env.HEDERA_TOPIC_ID,
          topicUrl: hashscan.topic(env.HEDERA_TOPIC_ID),
          messages,
        });
      } catch (err) {
        return Response.json(
          { configured: true, error: String(err).slice(0, 200), messages: [] },
          { status: 502 }
        );
      }
    }

    /**
     * Success metrics — hedera-spec §8.
     *
     * HONESTY RULE: every number here is either counted from the network or
     * folded from the session log. A counter that is not wired yet is OMITTED,
     * never reported as 0 — a fabricated zero is still a fabricated number, and
     * we quote these at the booth.
     */
    if (url.pathname === "/api/stats") {
      const stats: Record<string, unknown> = {
        network: "testnet",
        topicId: env.HEDERA_TOPIC_ID ?? null,
        treasuryAccountId: env.HEDERA_OPERATOR_ID ?? null,
        capTableTokenId: env.HEDERA_CAPTABLE_TOKEN_ID ?? null,
      };

      // Session-derived facts (the log is the source).
      const session = url.searchParams.get("session");
      if (session) {
        try {
          const res = await env.SESSION.getByName(session).fetch(
            new Request(`https://do/state?session=${encodeURIComponent(session)}`)
          );
          const s = (await res.json()) as {
            contributionsAccepted?: number;
            citationsServed?: number;
            unanchoredEvents?: number;
          };
          if (typeof s.contributionsAccepted === "number") {
            stats.contributionsAccepted = s.contributionsAccepted;
          }
          if (typeof s.citationsServed === "number") stats.citationsServed = s.citationsServed;
          if (typeof s.unanchoredEvents === "number") {
            stats.unanchoredEvents = s.unanchoredEvents;
          }
        } catch {
          // A missing session simply contributes no numbers.
        }
      }

      // Network-counted facts.
      try {
        if (env.HEDERA_TOPIC_ID) {
          stats.hcsMessages = await topicMessageCount(env.HEDERA_TOPIC_ID);
        }
        if (env.HEDERA_OPERATOR_ID) {
          stats.treasuryBalanceHbar = await accountBalance(env.HEDERA_OPERATOR_ID);
        }
      } catch (err) {
        return Response.json({ ...stats, error: String(err).slice(0, 200) }, { status: 502 });
      }

      // Deliberately absent until the payout path is wired: payouts,
      // distinctHumansPaid, totalHbarDistributed, accountsCreated.
      return Response.json(stats);
    }

    // WebSocket, session state, World verification, and ENS resolution all route
    // to the single writer for the session. /api/verify/* is the M3 proof gate;
    // /api/ens/* is the M5 identity layer.
    const isVerify = url.pathname.startsWith("/api/verify/");
    const isEns = url.pathname.startsWith("/api/ens/");
    const isSettlement = url.pathname === "/api/settlement";
    // ENSIP-26/27 discovery. These are the endpoints the agent's own ENS
    // records point at, so they have to be reachable: a record naming a route
    // that 404s is a claim we cannot back, and the whole "resolve the name to
    // reach the agent" story rests on them answering.
    const isAgent =
      url.pathname === "/.well-known/agent.json" || url.pathname.startsWith("/api/agent/");
    if (
      url.pathname === "/ws" ||
      url.pathname === "/api/state" ||
      isVerify ||
      isEns ||
      isAgent ||
      isSettlement
    ) {
      const search = url.searchParams;
      if (!search.get("session")) search.set("session", "default");
      const sessionId = search.get("session")!;
      // The DO is reached at https://do/..., so it cannot know the public
      // origin — and the ENS records and agent card it builds are URLs other
      // people have to fetch. Carry the real one.
      if (isEns || isAgent) search.set("origin", url.origin);
      const doPath =
        url.pathname === "/ws"
          ? "/ws"
          : url.pathname === "/api/state"
            ? "/state"
            : url.pathname === "/.well-known/agent.json"
              ? "/agent-card"
              : url.pathname.replace(/^\/api/, ""); // /verify/selfie, /agent/<name>, ...
      // getByName: same session id always routes to the same single writer.
      return env.SESSION.getByName(sessionId).fetch(
        new Request(`https://do${doPath}?${search.toString()}`, request)
      );
    }

    // Public CV route (M5): serve the SPA shell for /cv/<name> so the client can
    // render an agent's employment record resolved from ENS. The URL is kept.
    if (url.pathname.startsWith("/cv/")) {
      return env.ASSETS.fetch(new Request(new URL("/", url), request));
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
