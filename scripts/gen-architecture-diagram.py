#!/usr/bin/env python3
"""Generate the MASS system architecture diagram."""

from html import escape

W, H = 1840, 1140
out = []


def esc(s):
    return escape(s, quote=False)


def text(x, y, s, cls, anchor="start", dy=22):
    lines = s.split("\n")
    t = [f'<text x="{x}" y="{y}" text-anchor="{anchor}" class="{cls}">']
    for i, ln in enumerate(lines):
        t.append(f'<tspan x="{x}" dy="{0 if i == 0 else dy}">{esc(ln)}</tspan>')
    t.append("</text>")
    out.append("".join(t))


def group(x, y, w, h, title, cls="group", tone="sectionName"):
    out.append(f'<rect class="{cls}" x="{x}" y="{y}" width="{w}" height="{h}"/>')
    text(x + 26, y + 34, title, tone)


def box(x, y, w, h, title, body="", cls="box", tcls="smallLabel", bcls="body", dy=20, pad=20):
    out.append(f'<rect class="{cls}" x="{x}" y="{y}" width="{w}" height="{h}"/>')
    text(x + w / 2, y + 30, title, tcls, "middle")
    if body:
        text(x + pad, y + 54, body, bcls, dy=dy)


def arrow(pts, cls="flow", marker="arrow", dash=None):
    d = " ".join(("M" if i == 0 else "L") + f"{p[0]},{p[1]}" for i, p in enumerate(pts))
    extra = f' stroke-dasharray="{dash}"' if dash else ""
    out.append(f'<path class="{cls}" d="{d}" marker-end="url(#{marker})"{extra}/>')


def tag(x, y, s, cls="flowTag"):
    """A numbered chip sitting on a flow line."""
    w = 26 + len(s) * 8.2
    out.append(f'<rect class="tagBox" x="{x}" y="{y}" width="{w:.0f}" height="26" rx="13"/>')
    text(x + w / 2, y + 18, s, cls, "middle")


# --------------------------------------------------------------------------
# Brand marks. Hedera and ENS are the real logo paths; World and 0G are drawn
# to their mark's geometry, since neither publishes a redistributable SVG.
# --------------------------------------------------------------------------
HEDERA_PATHS = (
    '<path d="M1250,0C559.64,0,0,559.64,0,1250S559.64,2500,1250,2500s1250-559.64,'
    '1250-1250S1940.36,0,1250,0" fill="#222"/>'
    '<path d="M1758.12,1790.62H1599.38V1453.13H900.62v337.49H741.87V696.25H900.62v329.37h698.76V696.25'
    'h158.75Zm-850-463.75h698.75V1152.5H908.12Z" fill="#fff"/>'
)

ENS_PATH = (
    "M11.725.223 5.107 11.13a.146.146 0 0 1-.237.018c-.583-.692-2.753-3.64-.067-6.327 "
    "2.45-2.452 5.572-4.2 6.73-4.804.13-.068.269.08.192.206m-.366 23.747c.132.093.295-.064.206-.2"
    "-1.478-2.251-6.392-9.744-7.07-10.869-.67-1.11-1.987-2.953-2.097-4.53-.011-.158-.228-.19-.283-.042"
    "a10 10 0 0 0-.27.85c-1.105 4.11.5 8.472 3.985 10.916zm.909-.193 6.618-10.907a.146.146 0 0 1 .237-.018"
    "c.582.692 2.753 3.64.067 6.327-2.45 2.452-5.572 4.2-6.73 4.804-.13.068-.269-.08-.192-.206"
    "M12.641.028c-.132-.093-.295.065-.206.2 1.478 2.252 6.392 9.745 7.07 10.87.67 1.109 1.987 2.952 "
    "2.097 4.53.011.157.228.19.283.041.088-.239.182-.524.27-.85 1.105-4.11-.5-8.472-3.985-10.915z"
)


def logo(kind, x, y, size=44):
    """Draw a brand mark with its top-left at (x, y)."""
    if kind == "hedera":
        s = size / 2500
        out.append(f'<g transform="translate({x},{y}) scale({s:.6f})">{HEDERA_PATHS}</g>')
    elif kind == "ens":
        s = size / 24
        out.append(
            f'<g transform="translate({x},{y}) scale({s:.5f})">'
            f'<path d="{ENS_PATH}" fill="#0080BC"/></g>'
        )
    elif kind == "world":
        r = size / 2
        cx, cy = x + r, y + r
        out.append(
            f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#111"/>'
            f'<circle cx="{cx}" cy="{cy}" r="{r * 0.60}" fill="none" stroke="#fff" stroke-width="{size*0.085:.2f}"/>'
            f'<ellipse cx="{cx}" cy="{cy}" rx="{r * 0.26}" ry="{r * 0.60}" fill="none" '
            f'stroke="#fff" stroke-width="{size*0.085:.2f}"/>'
        )
    elif kind == "zg":
        out.append(
            f'<rect x="{x}" y="{y}" width="{size}" height="{size}" rx="{size*0.26:.1f}" fill="#111"/>'
            f'<text x="{x + size/2}" y="{y + size*0.70}" text-anchor="middle" '
            f'class="logoText" style="font-size:{size*0.46:.1f}px">0G</text>'
        )


def chainCard(x, y, w, h, kind, name, sub, body):
    out.append(f'<rect class="chainBox" x="{x}" y="{y}" width="{w}" height="{h}"/>')
    logo(kind, x + 20, y + 18, 44)
    text(x + 78, y + 38, name, "smallLabel")
    text(x + 78, y + 58, sub, "tiny")
    text(x + 20, y + 92, body, "body", dy=20)


# ==========================================================================
out.append(
    f'<?xml version="1.0" encoding="UTF-8"?>\n'
    f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" '
    f'viewBox="0 0 {W} {H}" role="img" aria-labelledby="title desc">'
)
out.append('<title id="title">MASS system architecture</title>')
out.append(
    '<desc id="desc">How a MASS session runs: verified humans in a browser, one Durable Object '
    'per session holding the event log, inference and archive on 0G, provenance and payroll on '
    'Hedera, personhood from World, and identity from ENS.</desc>'
)

out.append(
    """<defs>
  <marker id="arrow" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto" markerUnits="strokeWidth">
    <path d="M2,2 L10,6 L2,10 Z" fill="#475569"/>
  </marker>
  <marker id="arrowAmber" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto" markerUnits="strokeWidth">
    <path d="M2,2 L10,6 L2,10 Z" fill="#b45309"/>
  </marker>
  <marker id="arrowGreen" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto" markerUnits="strokeWidth">
    <path d="M2,2 L10,6 L2,10 Z" fill="#15803d"/>
  </marker>
  <filter id="softShadow" x="-12%" y="-12%" width="126%" height="132%">
    <feDropShadow dx="0" dy="7" stdDeviation="9" flood-color="#0f172a" flood-opacity="0.10"/>
  </filter>
  <linearGradient id="coreGrad" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#eef6ff"/><stop offset="1" stop-color="#f8fbff"/>
  </linearGradient>
  <linearGradient id="chainGrad" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#f6fdf9"/><stop offset="1" stop-color="#fbfefc"/>
  </linearGradient>
  <linearGradient id="clientGrad" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#fdf9f4"/><stop offset="1" stop-color="#fffdfa"/>
  </linearGradient>
</defs>
<style>
  .bg { fill: #f8fafc; }
  .title { font: 800 44px Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; fill: #0f172a; }
  .subtitle { font: 550 19px Inter, ui-sans-serif, system-ui, sans-serif; fill: #475569; }
  .sectionName { font: 800 21px Inter, ui-sans-serif, system-ui, sans-serif; fill: #0f172a; letter-spacing: .04em; }
  .smallLabel { font: 750 18px Inter, ui-sans-serif, system-ui, sans-serif; fill: #0f172a; }
  .body { font: 500 15px Inter, ui-sans-serif, system-ui, sans-serif; fill: #475569; }
  .tiny { font: 600 13px Inter, ui-sans-serif, system-ui, sans-serif; fill: #64748b; }
  .mono { font: 500 14px ui-monospace, SFMono-Regular, Menlo, monospace; fill: #475569; }
  .flowTag { font: 750 14px Inter, ui-sans-serif, system-ui, sans-serif; fill: #0f172a; }
  .logoText { font: 800 20px Inter, ui-sans-serif, system-ui, sans-serif; fill: #fff; }
  .group { fill: #ffffff; stroke: #cbd5e1; stroke-width: 1.4; rx: 20; }
  .groupCore { fill: url(#coreGrad); stroke: #93c5fd; stroke-width: 2; rx: 22; }
  .groupChain { fill: url(#chainGrad); stroke: #86efac; stroke-width: 2; rx: 22; }
  .groupClient { fill: url(#clientGrad); stroke: #fcd9a8; stroke-width: 2; rx: 22; }
  .box { fill: #ffffff; stroke: #cbd5e1; stroke-width: 1.2; rx: 12; filter: url(#softShadow); }
  .plain { fill: #ffffff; stroke: #cbd5e1; stroke-width: 1.2; rx: 12; }
  .blueBox { fill: #dbeafe; stroke: #60a5fa; stroke-width: 1.4; rx: 12; }
  .amberBox { fill: #fef3c7; stroke: #f59e0b; stroke-width: 1.4; rx: 12; }
  .chainBox { fill: #ffffff; stroke: #cbd5e1; stroke-width: 1.2; rx: 14; filter: url(#softShadow); }
  .tagBox { fill: #ffffff; stroke: #94a3b8; stroke-width: 1.2; }
  .dashed { fill: #ffffff; fill-opacity: .55; stroke: #cbd5e1; stroke-width: 1.2; stroke-dasharray: 6 5; rx: 14; }
  .flow { fill: none; stroke: #475569; stroke-width: 2.2; }
  .flowAmber { fill: none; stroke: #b45309; stroke-width: 2.2; }
  .flowGreen { fill: none; stroke: #15803d; stroke-width: 2.2; }
</style>"""
)

out.append(f'<rect class="bg" x="0" y="0" width="{W}" height="{H}"/>')
text(56, 66, "MASS — System Architecture", "title")
text(58, 104, "Verified humans build one agent together. Every contribution is signed, anchored, and owned — and the payroll follows the same log.", "subtitle")

# ---------------------------------------------------------------- 1. Crew
group(50, 150, 300, 400, "CREW")
box(80, 196, 240, 106, "Verified human", "One seat per person.\nSigner · Builder · Observer", "amberBox")
box(80, 322, 240, 92, "Wallet holder", "ENS name as login.\nMay co-sign; not\nsybil-checked.", "plain", dy=18)
box(80, 434, 240, 92, "Client / employer", "Hires the agent,\npays per job.", "plain")

# ------------------------------------------------------------- 2. Browser
group(400, 150, 400, 626, "BROWSER  ·  React + assistant-ui", "groupClient")
box(430, 190, 340, 116, "Session thread", "Streaming chat. Token deltas\nnever touch the event log.", "blueBox")
box(430, 322, 340, 116, "Crew rail", "Live seats, tiers, event feed,\nHCS ticker with HashScan links.", "blueBox")
box(430, 454, 340, 116, "Review sheet", "Mid- and end-session harvest.\nTwo signers merge a contribution.", "blueBox")
# Standalone pages — same browser, different job. They exist outside a
# session, so they get their own frame rather than sitting in the session UI.
out.append('<rect class="dashed" x="424" y="588" width="352" height="164"/>')
text(440, 612, "STANDALONE PAGES  ·  no session, no seat", "tiny")
box(438, 624, 324, 56, "Agent CV  /cv/<name>", "", "plain")
box(438, 690, 324, 56, "Subname console  /ens-admin", "", "plain")

# ---------------------------------------------------------------- 3. Core
group(850, 150, 470, 620, "CLOUDFLARE  ·  edge", "groupCore")
box(880, 196, 410, 86, "Worker", "Routes /api and /ws · serves the SPA", "plain")
out.append('<rect class="box" x="880" y="306" width="410" height="330"/>')
text(1085, 338, "Durable Object — SessionRoom", "smallLabel", "middle")
text(1085, 360, "One per session. The single writer.", "tiny", "middle")

box(902, 380, 176, 118, "Event log", "Append-only.\nHashed before it\ntakes a sequence\nnumber.", "plain", "smallLabel", "tiny", dy=19, pad=16)
box(1094, 380, 176, 118, "Replay", "Deterministic fold.\nNo clock, no\nrandomness,\nno I/O.", "plain", "smallLabel", "tiny", dy=19, pad=16)
box(902, 512, 176, 108, "Authority", "Tier decides who\nmay run canonical,\nand who may sign.", "plain", "smallLabel", "tiny", dy=19, pad=16)
box(1094, 512, 176, 108, "Attribution", "Which chunks an\nanswer used — the\npayroll input.", "plain", "smallLabel", "tiny", dy=19, pad=16)

box(880, 662, 410, 88, "Node sidecar  ·  Railway", "0G Storage and the Hedera SDK need gRPC and\nNode internals a Worker cannot give them.", "amberBox")

# ------------------------------------------------------------- 4. Web3
group(1370, 150, 420, 940, "WEB3  ·  what the app cannot fake alone", "groupChain")

chainCard(1396, 196, 368, 196, "world", "World", "Proof of personhood  ·  seat.claimed",
          "Selfie Check proof, verified\nserver-side. One human, one seat.\nSybil score sets the tier — a\nwallet signature never can.")
chainCard(1396, 414, 368, 196, "ens", "ENS", "Identity and provenance  ·  live resolve",
          "Every seat and the agent get a\nsubname. Citations resolve live;\na name that fails to resolve is\nshown as unverified, not hidden.")
chainCard(1396, 632, 368, 196, "zg", "0G", "Inference and archive  ·  TEE run",
          "Router runs every answer in a TEE\ntrust mode. Storage holds the full\nsession archive — the brain keeps\nonly what the crew accepted.")
chainCard(1396, 850, 368, 214, "hedera", "Hedera", "Provenance and payroll  ·  anchor + payout",
          "HCS anchors a hash of each event —\nhashes only, never content. HTS\nand HBAR transfers settle a job:\n70% follows use, 30% ownership.\nMirror Node feeds the live ticker.")

# ------------------------------------------------------------ 5. Bottom
group(50, 830, 1290, 238, "THE LOOP  ·  what a contribution goes through")

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
    box(x, 878, sw, 118, t, b, "plain", "smallLabel", "tiny", dy=19, pad=18)
    if i < len(steps) - 1:
        arrow([(x + sw + 2, 937), (x + sw + gap - 4, 937)])

text(86, 1034, "The archive keeps everything. The brain keeps only what was accepted — that gap is the product, not a limitation.", "body")

# ----------------------------------------------------------- 6. Flows
# Crew -> browser
arrow([(320, 243), (428, 243)])
# Browser -> worker (WS)
arrow([(772, 248), (878, 239)])
tag(786, 196, "1 · WebSocket intents")
# Worker -> DO
arrow([(1085, 284), (1085, 304)], "flow")
# DO -> browser (deltas)
arrow([(878, 420), (774, 382)], "flow")
tag(786, 330, "2 · token deltas")

# World -> worker
arrow([(1394, 262), (1292, 240)], "flowGreen", "arrowGreen")
# ENS <-> DO
arrow([(1394, 486), (1292, 452)], "flowGreen", "arrowGreen")
# 0G <-> DO
arrow([(1394, 700), (1294, 618)], "flowGreen", "arrowGreen")
# sidecar -> hedera / 0g storage
arrow([(1290, 706), (1394, 730)], "flowAmber", "arrowAmber")
arrow([(1290, 716), (1394, 900)], "flowAmber", "arrowAmber")

out.append("</svg>")

path = "/Users/aonishchenko/Desktop/Development/ETHGlobal/Mass/docs/architecture/assets/architecture-system.svg"
open(path, "w").write("\n".join(out))
print("wrote", path)
