#!/usr/bin/env python3
"""
Diagram 2 — the simplified architecture.

Same system as the detailed diagram, told at the level someone seeing MASS for
the first time can hold: one human, one client, one engine, four chains. Where
the detailed version names files and failure modes, this one names jobs.

Regenerate:  python3 scripts/gen-architecture-simple.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from diagram_kit import Canvas  # noqa: E402

OUT = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "docs/architecture/assets/architecture-simplified.svg",
)

c = Canvas(
    1840,
    1160,
    "MASS architecture — simplified",
    "A simplified view of MASS: a human authenticates with World and ENS, works "
    "in a browser client, and the AI Sessions Engine runs inference on 0G, "
    "anchors logs to Hedera, and settles payouts by contribution and use.",
)

c.header(
    "MASS — How It Works",
    "Verified humans build one agent together. Every contribution is signed, anchored, and owned — and the payout follows the same log.",
)

# ------------------------------------------------------------------ Human
c.box(
    50, 230, 210, 132,
    "Human",
    "Signs in with World\nor an ENS name.\nOne person, one seat.",
    "amberBox", dy=19, pad=18,
)

# --------------------------------------------------------- Browser client
c.group(300, 150, 380, 620, "BROWSER CLIENT", "React", "groupClient")
c.box(328, 230, 324, 116, "Session thread", "Everyone talks to the same\nagent, in one conversation.", "blueBox")
c.box(328, 364, 324, 116, "Crew rail", "Who is here, what tier they\nhold, what just happened.", "blueBox")
c.box(328, 498, 324, 116, "Review sheet", "Where a contribution is\nproposed and co-signed.", "blueBox")
c.box(
    328, 632, 324, 116,
    "Live evidence",
    "Ledger ticker, agent CV, cap\ntable — refreshing on their own.",
    "blueBox",
)

# ------------------------------------------------------ AI Sessions Engine
c.group(710, 150, 630, 612, "AI SESSIONS ENGINE", "Cloudflare Workers + Durable Objects", "groupCore")

L, R, BW, BH = 734, 1040, 286, 124
c.logoBox(L, 230, BW, BH, [], "CF Worker",
          "Routes the API and the live socket,\nserves the client, and hands each\nsession to its own single writer.")
c.logoBox(R, 230, BW, BH, ["world", "ens"], "Auth",
          "World proves a unique human.\nENS gives every seat a name\nthat resolves outside our app.")

c.logoBox(L, 370, BW, BH, [], "Session Room",
          "One per session. An append-only\nevent log; every view of the\nsession is a fold over it.")
c.logoBox(R, 370, BW, BH, ["hedera"], "Ledger",
          "A hash of each event is anchored\nto the public ledger — hashes\nonly, never the content.")

c.logoBox(L, 510, BW, BH, ["zg"], "LLM harness",
          "Runs every answer on the 0G\nRouter in a trusted enclave,\nframed by what the crew taught.")
c.logoBox(R, 510, BW, BH, ["zg"], "Attribution + storage",
          "Measures which knowledge an\nanswer used, and archives the\nwhole session to 0G Storage.")

c.logoBox(L, 650, BW, 92, ["hedera"], "Payout engine",
          "Splits a job by use and ownership.")
c.logoBox(R, 650, BW, 92, [], "Node sidecar", "The parts that cannot run on the edge.", "amberBox")

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
c.arrow([(262, 296), (326, 296)])
c.arrow([(654, 282), (732, 276)])
c.arrow([(732, 430), (656, 418)])

c.arrow([(1394, 320), (1342, 300)], "flowGreen", "arrowGreen")
c.arrow([(1394, 528), (1342, 440)], "flowGreen", "arrowGreen")
c.arrow([(1394, 736), (1342, 578)], "flowGreen", "arrowGreen")
c.arrow([(1394, 944), (1342, 700)], "flowGreen", "arrowGreen")

# ----------------------------------------------------------------- Loop
c.group(50, 820, 1290, 254, "THE LOOP", "what a contribution goes through")

steps = [
    ("Talk", "Authenticated users\ncollaborate in one\nAI session."),
    ("Harvest", "Valuable inputs are\npicked out and credited\nto whoever gave them."),
    ("Sign", "Signers reach consensus\nand approve the\ncontribution."),
    ("Brain", "The knowledge enters\nthe brain and the\ncap table together."),
    ("Cite", "Answers cite the\nknowledge and the\nhuman behind it."),
    ("Payouts", "Premium split by\ncontribution and by\nwhat the job used."),
]
sx, sw, gap = 86, 196, 12
for i, (t, b) in enumerate(steps):
    x = sx + i * (sw + gap)
    c.box(x, 890, sw, 128, t, b, "plain", "smallLabel", "tiny", dy=19, pad=18)
    if i < len(steps) - 1:
        c.arrow([(x + sw + 1, 954), (x + sw + gap - 3, 954)])

c.text(86, 1048,
       "The archive keeps everything. The brain keeps only what the crew accepted — that gap is the product, not a limitation.",
       "body")

c.save(OUT)
