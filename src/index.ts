/**
 * Worker entry. Routes WebSocket upgrades to the session's Durable Object and
 * serves the built assistant-ui app for everything else.
 */

import { SessionRoom, type Env } from "./session-do.js";

export { SessionRoom };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/ws" || url.pathname === "/api/state") {
      const sessionId = url.searchParams.get("session") ?? "default";
      // getByName: same session id always routes to the same single writer.
      return env.SESSION.getByName(sessionId).fetch(
        new Request(
          url.pathname === "/api/state"
            ? `https://do/state?session=${sessionId}`
            : `https://do/ws?session=${sessionId}`,
          request
        )
      );
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
