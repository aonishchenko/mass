#!/usr/bin/env python3
"""
Diagram 1 — the detailed architecture.

The engineering view: named components, the request path, and the constraints
that forced the shape (single writer, the sidecar, hash-before-seq). For the
version to show someone in the first thirty seconds, see
gen-architecture-simple.py — both draw from scripts/diagram_kit.py so they stay
siblings rather than drifting apart.

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
    1140,
    "MASS system architecture",
    "How a MASS session runs: verified humans in a browser, one Durable Object "
    "per session holding the event log, inference and archive on 0G, provenance "
    "and payroll on Hedera, personhood from World, and identity from ENS.",
)

c.header(
    "MASS — System Architecture",
    "Verified humans build one agent together. Every contribution is signed, anchored, and owned — and the payroll follows the same log.",
)

# ---------------------------------------------------------------- 1. Crew
c.group(50, 150, 300, 400, "CREW")
c.box(80, 196, 240, 106, "Verified human", "One seat per person.\nSigner · Builder · Observer", "amberBox")
c.box(80, 322, 240, 92, "Wallet holder", "ENS name as login.\nMay co-sign; not\nsybil-checked.", "plain", dy=18)
c.box(80, 434, 240, 92, "Client / employer", "Hires the agent,\npays per job.", "plain")

# ------------------------------------------------------------- 2. Browser
c.group(400, 150, 400, 626, "BROWSER  ·  React + assistant-ui", "", "groupClient")
c.box(430, 190, 340, 116, "Session thread", "Streaming chat. Token deltas\nnever touch the event log.", "blueBox")
c.box(430, 322, 340, 116, "Crew rail", "Live seats, tiers, event feed,\nHCS ticker with HashScan links.", "blueBox")
c.box(430, 454, 340, 116, "Review sheet", "Mid- and end-session harvest.\nTwo signers merge a contribution.", "blueBox")
# Standalone pages — same browser, different job. They exist outside a
# session, so they get their own frame rather than sitting in the session UI.
c.out.append('<rect class="dashed" x="424" y="588" width="352" height="164"/>')
c.text(440, 612, "STANDALONE PAGES  ·  no session, no seat", "tiny")
c.box(438, 624, 324, 56, "Agent CV  /cv/<name>", "", "plain")
c.box(438, 690, 324, 56, "Subname console  /ens-admin", "", "plain")

# ---------------------------------------------------------------- 3. Core
c.group(850, 150, 470, 620, "CLOUDFLARE  ·  edge", "", "groupCore")
c.box(880, 196, 410, 86, "Worker", "Routes /api and /ws · serves the SPA", "plain")
c.out.append('<rect class="box" x="880" y="306" width="410" height="330"/>')
c.text(1085, 338, "Durable Object — SessionRoom", "smallLabel", "middle")
c.text(1085, 360, "One per session. The single writer.", "tiny", "middle")

c.box(902, 380, 176, 118, "Event log", "Append-only.\nHashed before it\ntakes a sequence\nnumber.", "plain", "smallLabel", "tiny", dy=19, pad=16)
c.box(1094, 380, 176, 118, "Replay", "Deterministic fold.\nNo clock, no\nrandomness,\nno I/O.", "plain", "smallLabel", "tiny", dy=19, pad=16)
c.box(902, 512, 176, 108, "Authority", "Tier decides who\nmay run canonical,\nand who may sign.", "plain", "smallLabel", "tiny", dy=19, pad=16)
c.box(1094, 512, 176, 108, "Attribution", "Which chunks an\nanswer used — the\npayroll input.", "plain", "smallLabel", "tiny", dy=19, pad=16)

c.box(880, 662, 410, 88, "Node sidecar  ·  Railway", "0G Storage and the Hedera SDK need gRPC and\nNode internals a Worker cannot give them.", "amberBox")

# ------------------------------------------------------------- 4. Web3
c.group(1370, 150, 420, 940, "WEB3  ·  what the app cannot fake alone", "", "groupChain")

c.chainCard(1396, 196, 368, 196, "world", "World", "Proof of personhood  ·  seat.claimed",
          "Selfie Check proof, verified\nserver-side. One human, one seat.\nSybil score sets the tier — a\nwallet signature never can.")
c.chainCard(1396, 414, 368, 196, "ens", "ENS", "Identity and provenance  ·  live resolve",
          "Every seat and the agent get a\nsubname. Citations resolve live;\na name that fails to resolve is\nshown as unverified, not hidden.")
c.chainCard(1396, 632, 368, 196, "zg", "0G", "Inference and archive  ·  TEE run",
          "Router runs every answer in a TEE\ntrust mode. Storage holds the full\nsession archive — the brain keeps\nonly what the crew accepted.")
c.chainCard(1396, 850, 368, 214, "hedera", "Hedera", "Provenance and payroll  ·  anchor + payout",
          "HCS anchors a hash of each event —\nhashes only, never content. HTS\nand HBAR transfers settle a job:\n70% follows use, 30% ownership.\nMirror Node feeds the live ticker.")

# ------------------------------------------------------------ 5. Bottom
c.group(50, 830, 1290, 238, "THE LOOP  ·  what a contribution goes through")

steps = [
    ("Talk", "Anyone chats.\nNothing is\ntaught yet."),
    ("Harvest", "Extraction filters\nfor durable\nknowledge only."),
    ("Sign", "Two verified\nhumans merge\nthe contribution."),
    ("Brain", "Chunk enters the\nbrain and the\ncap table."),
    ("Cite", "Answers cite the\nchunk and the\nhuman behind it."),
    ("Pay", "Job settles along\nuse + ownership."),
]
sx, sw, gap = 86, 190, 16
for i, (t, b) in enumerate(steps):
    x = sx + i * (sw + gap)
    c.box(x, 878, sw, 118, t, b, "plain", "smallLabel", "tiny", dy=19, pad=18)
    if i < len(steps) - 1:
        c.arrow([(x + sw + 2, 937), (x + sw + gap - 4, 937)])

c.text(86, 1034, "The archive keeps everything. The brain keeps only what was accepted — that gap is the product, not a limitation.", "body")

# ----------------------------------------------------------- 6. Flows
# Crew -> browser
c.arrow([(320, 243), (428, 243)])
# Browser -> worker (WS)
c.arrow([(772, 248), (878, 239)])
c.tag(786, 196, "1 · WebSocket intents")
# Worker -> DO
c.arrow([(1085, 284), (1085, 304)], "flow")
# DO -> browser (deltas)
c.arrow([(878, 420), (774, 382)], "flow")
c.tag(786, 330, "2 · token deltas")

# World -> worker
c.arrow([(1394, 262), (1292, 240)], "flowGreen", "arrowGreen")
# ENS <-> DO
c.arrow([(1394, 486), (1292, 452)], "flowGreen", "arrowGreen")
# 0G <-> DO
c.arrow([(1394, 700), (1294, 618)], "flowGreen", "arrowGreen")
# sidecar -> hedera / 0g storage
c.arrow([(1290, 706), (1394, 730)], "flowAmber", "arrowAmber")
c.arrow([(1290, 716), (1394, 900)], "flowAmber", "arrowAmber")

c.save(OUT)
