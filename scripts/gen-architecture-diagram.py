#!/usr/bin/env python3
"""
The MASS architecture diagram.

Every arrow corresponds to a call that exists in the code, and the layout was
chosen so those real dependencies are short lines rather than a hairball:

  browser  -> worker              web/src/session.ts   (WS + /api)
  worker   -> auth                src/session-do.ts    (/verify/* handlers)
  worker   -> session room        src/index.ts         (env.SESSION.getByName)
  auth     -> World / ENS         src/world/verify.ts, src/ens/*.ts
  room     -> LLM harness         src/zg/inference.ts
  room     -> cap table           src/core/reduce.ts   capTable()
  room     -> ledger              src/session-do.ts    emit() anchors each event
  harness  -> attribution         src/core/attribution.ts (chunks actually used)
  harness  -> 0G Router           direct HTTPS from the Worker, no sidecar
  captable -> payout              src/hedera/split.ts  (the 30% ownership leg)
  attrib   -> payout              src/hedera/split.ts  (the 70% use leg)
  ledger   -> sidecar -> Hedera   services/zg-storage/hedera.mjs (SDK needs gRPC)
  attrib   -> sidecar -> 0G       services/zg-storage/index.mjs  (Storage SDK)

Regenerate:  python3 scripts/gen-architecture-diagram.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from diagram_kit import Canvas  # noqa: E402

OUT = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "docs/architecture/assets/architecture-system.svg",
)

c = Canvas(
    1840,
    1150,
    "MASS system architecture",
    "How MASS runs: a browser client, an AI Sessions Engine built on Cloudflare "
    "Workers and Durable Objects, and four onchain layers — World for "
    "personhood, ENS for identity, 0G for inference and archive, Hedera for "
    "provenance and payouts.",
)

c.header(
    "MASS — How It Works",
    "Verified humans build one agent together. Every contribution is signed, anchored, and owned — and the payout follows the same log.",
)

# --------------------------------------------------------- Browser client
c.group(50, 150, 380, 620, "BROWSER CLIENT", "React", "groupClient")
c.box(78, 230, 324, 116, "Session thread", "Everyone talks to the same\nagent, in one conversation.", "blueBox")
c.box(78, 364, 324, 116, "Crew rail", "Who is here, what tier they\nhold, what just happened.", "blueBox")
c.box(78, 498, 324, 116, "Review sheet", "Where a contribution is\nproposed and co-signed.", "blueBox")
c.box(78, 632, 324, 116, "Live evidence",
      "Ledger ticker, agent CV, cap\ntable — refreshing on their own.", "blueBox")

# ------------------------------------------------------ AI Sessions Engine
c.group(470, 150, 860, 730, "AI SESSIONS ENGINE", "Cloudflare Workers + Durable Objects", "groupCore")

L, R, BW, BH = 496, 910, 390, 118
r1, r2, r3, r4 = 230, 364, 498, 632

c.logoBox(L, r1, BW, BH, [], "CF Worker",
          "Routes the API and the live socket, serves the\nclient, and hands each session to its own\nsingle writer.")
c.logoBox(R, r1, BW, BH, ["world", "ens"], "Auth",
          "World proves a unique human. ENS gives every\nseat a name that resolves outside our app.")

c.logoBox(L, r2, BW, BH, [], "Session Room",
          "One per session. An append-only event log —\nevery view of the session is a fold over it,\nand nothing else may write.")
c.logoBox(R, r2, BW, BH, ["zg"], "LLM harness",
          "Runs every answer on the 0G Router in a trusted\nenclave, framed by what the crew has taught.")

c.logoBox(L, r3, BW, BH, [], "Cap table",
          "Ownership derived from accepted contributions.\nNever hand-set — it is a fold over the log.")
c.logoBox(R, r3, BW, BH, ["zg"], "Attribution + storage",
          "Measures which knowledge an answer actually\nused, and archives the whole session to 0G.")

c.logoBox(L, r4, BW, BH, ["hedera"], "Ledger",
          "Anchors a hash of each event to the public\nledger — hashes only, never the content.")
c.logoBox(R, r4, BW, BH, ["hedera"], "Payout engine",
          "Splits a job 70% by what it used, 30% by who\nowns it, in whole units that reconcile exactly.")

c.logoBox(496, 766, 804, 92, [], "Node sidecar",
          "The two SDKs that cannot run on the edge: Hedera needs gRPC, 0G Storage needs Node internals.")

# -------------------------------------------------------------- Onchain
c.group(1370, 150, 420, 930, "ONCHAIN", "what the app cannot vouch for alone", "groupChain")

c.chainCard(1396, 226, 368, 190, "world", "World", "Proof of personhood",
            "Verifies that a seat is a real,\nunique person — the thing a\nwallet signature can never show.")
c.chainCard(1396, 434, 368, 190, "ens", "ENS", "Identity and provenance",
            "Names every seat and the agent.\nCitations resolve live, so a claim\ncan be checked outside MASS.")
c.chainCard(1396, 642, 368, 190, "zg", "0G", "Inference and archive",
            "Runs the model in a trusted\nenclave and keeps the full\nsession archive.")
c.chainCard(1396, 850, 368, 208, "hedera", "Hedera", "Provenance and payouts",
            "Timestamps the log so the order\nof contributions is not ours to\nedit, and settles the money that\nfollows it.")

# ---------------------------------------------------------------- Flows
LC, RC = L + BW / 2, R + BW / 2  # column centres

# Browser <-> Worker: intents out, answers back.
c.arrow([(432, 264), (494, 264)])
c.arrow([(494, 312), (432, 312)])

# The Worker verifies sideways and hands everything else to the single writer.
c.arrow([(L + BW + 2, r1 + BH / 2), (R - 4, r1 + BH / 2)])
c.arrow([(LC, r1 + BH + 2), (LC, r2 - 4)])

# The room drives inference; the log derives the cap table.
c.arrow([(L + BW + 2, r2 + BH / 2), (R - 4, r2 + BH / 2)])
c.arrow([(LC, r2 + BH + 2), (LC, r3 - 4)])

# Attribution measures what the harness actually put in front of the model.
c.arrow([(RC, r2 + BH + 2), (RC, r3 - 4)])

# Both legs of the split feed the payout engine: ownership from the cap table,
# use from attribution.
c.arrow([(L + BW + 2, r3 + BH - 24), (R - 4, r4 + 34)])
c.arrow([(RC, r3 + BH + 2), (RC, r4 - 4)])

# The room anchors its own events. Routed down the outer margin so the line does
# not cut through the two boxes that sit between them.
c.arrow([(L - 4, r2 + BH / 2), (482, r2 + BH / 2), (482, r4 + BH / 2), (L - 6, r4 + BH / 2)])

# Everything that writes to a chain from a real SDK goes out through the sidecar.
c.arrow([(LC, r4 + BH + 2), (LC, 762)], "flowAmber", "arrowAmber")
c.arrow([(RC, r4 + BH + 2), (RC, 762)], "flowAmber", "arrowAmber")

# Engine -> chains.
c.arrow([(R + BW + 2, r1 + 42), (1394, 300)], "flowGreen", "arrowGreen")   # Auth -> World
c.arrow([(R + BW + 2, r1 + 92), (1394, 492)], "flowGreen", "arrowGreen")   # Auth -> ENS
c.arrow([(R + BW + 2, r2 + 74), (1394, 700)], "flowGreen", "arrowGreen")   # harness -> 0G Router
c.arrow([(1302, 796), (1394, 776)], "flowGreen", "arrowGreen")             # sidecar -> 0G Storage
c.arrow([(1302, 830), (1394, 912)], "flowGreen", "arrowGreen")             # sidecar -> Hedera

c.text(50, 1128,
       "The archive keeps everything. The brain keeps only what the crew accepted — that gap is the product, not a limitation.",
       "body")

c.save(OUT)
