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

    /** Success metrics — hedera-spec §8. Counted from the network, not locally. */
    if (url.pathname === "/api/stats") {
      const stats = {
        network: "testnet",
        topicId: env.HEDERA_TOPIC_ID ?? null,
        treasuryAccountId: env.HEDERA_OPERATOR_ID ?? null,
        capTableTokenId: env.HEDERA_CAPTABLE_TOKEN_ID ?? null,
        hcsMessages: 0,
        treasuryBalanceHbar: 0,
        accountsCreated: 0,
        transactions: 0,
        payouts: 0,
        distinctHumansPaid: 0,
        totalHbarDistributed: 0,
      };

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

      return Response.json(stats);
    }

    // WebSocket, session state, and World verification all route to the single
    // writer for the session. /api/verify/* is the M3 server-side proof gate.
    const isVerify = url.pathname.startsWith("/api/verify/");
    if (url.pathname === "/ws" || url.pathname === "/api/state" || isVerify) {
      const search = url.searchParams;
      if (!search.get("session")) search.set("session", "default");
      const sessionId = search.get("session")!;
      const doPath =
        url.pathname === "/ws"
          ? "/ws"
          : url.pathname === "/api/state"
            ? "/state"
            : url.pathname.replace(/^\/api/, ""); // /verify/selfie, /verify/context, ...
      // getByName: same session id always routes to the same single writer.
      return env.SESSION.getByName(sessionId).fetch(
        new Request(`https://do${doPath}?${search.toString()}`, request)
      );
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
