#!/usr/bin/env python3
"""
Shared drawing kit for the architecture diagrams.

Two diagrams are generated from this: the detailed one and the simplified one.
They must look like siblings, so the palette, type scale, and brand marks live
here rather than being copied and drifting apart.
"""

from html import escape

# --------------------------------------------------------------------------
# Brand marks. Hedera and ENS are the official logo paths; World and 0G are
# drawn to their mark's geometry, because neither publishes a redistributable
# SVG. They are recognisable, not official assets — do not present them as such.
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

STYLE = """<defs>
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
  .sectionSub { font: 600 14px Inter, ui-sans-serif, system-ui, sans-serif; fill: #64748b; letter-spacing: .02em; }
  .smallLabel { font: 750 18px Inter, ui-sans-serif, system-ui, sans-serif; fill: #0f172a; }
  .body { font: 500 15px Inter, ui-sans-serif, system-ui, sans-serif; fill: #475569; }
  .tiny { font: 600 13px Inter, ui-sans-serif, system-ui, sans-serif; fill: #64748b; }
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


class Canvas:
    def __init__(self, width, height, title, desc):
        self.w, self.h = width, height
        self.out = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
            f'viewBox="0 0 {width} {height}" role="img" aria-labelledby="title desc">',
            f'<title id="title">{escape(title, quote=False)}</title>',
            f'<desc id="desc">{escape(desc, quote=False)}</desc>',
            STYLE,
            f'<rect class="bg" x="0" y="0" width="{width}" height="{height}"/>',
        ]

    # -- primitives --------------------------------------------------------
    def text(self, x, y, s, cls, anchor="start", dy=22):
        parts = [f'<text x="{x}" y="{y}" text-anchor="{anchor}" class="{cls}">']
        for i, ln in enumerate(s.split("\n")):
            parts.append(f'<tspan x="{x}" dy="{0 if i == 0 else dy}">{escape(ln, quote=False)}</tspan>')
        parts.append("</text>")
        self.out.append("".join(parts))

    def header(self, title, subtitle):
        self.text(56, 66, title, "title")
        self.text(58, 104, subtitle, "subtitle")

    def group(self, x, y, w, h, title, sub="", cls="group"):
        self.out.append(f'<rect class="{cls}" x="{x}" y="{y}" width="{w}" height="{h}"/>')
        self.text(x + 26, y + 34, title, "sectionName")
        if sub:
            self.text(x + 26, y + 56, sub, "sectionSub")

    def box(self, x, y, w, h, title, body="", cls="box", tcls="smallLabel",
            bcls="body", dy=20, pad=20, top=30, btop=54):
        self.out.append(f'<rect class="{cls}" x="{x}" y="{y}" width="{w}" height="{h}"/>')
        self.text(x + w / 2, y + top, title, tcls, "middle")
        if body:
            self.text(x + pad, y + btop, body, bcls, dy=dy)

    def arrow(self, pts, cls="flow", marker="arrow"):
        d = " ".join(("M" if i == 0 else "L") + f"{p[0]},{p[1]}" for i, p in enumerate(pts))
        self.out.append(f'<path class="{cls}" d="{d}" marker-end="url(#{marker})"/>')

    def tag(self, x, y, s):
        w = 26 + len(s) * 8.2
        self.out.append(f'<rect class="tagBox" x="{x}" y="{y}" width="{w:.0f}" height="26" rx="13"/>')
        self.text(x + w / 2, y + 18, s, "flowTag", "middle")

    # -- brand marks -------------------------------------------------------
    def logo(self, kind, x, y, size=44):
        if kind == "hedera":
            s = size / 2500
            self.out.append(f'<g transform="translate({x},{y}) scale({s:.6f})">{HEDERA_PATHS}</g>')
        elif kind == "ens":
            s = size / 24
            self.out.append(
                f'<g transform="translate({x},{y}) scale({s:.5f})">'
                f'<path d="{ENS_PATH}" fill="#0080BC"/></g>'
            )
        elif kind == "world":
            r = size / 2
            cx, cy = x + r, y + r
            sw = size * 0.085
            self.out.append(
                f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#111"/>'
                f'<circle cx="{cx}" cy="{cy}" r="{r * 0.60}" fill="none" stroke="#fff" stroke-width="{sw:.2f}"/>'
                f'<ellipse cx="{cx}" cy="{cy}" rx="{r * 0.26}" ry="{r * 0.60}" fill="none" '
                f'stroke="#fff" stroke-width="{sw:.2f}"/>'
            )
        elif kind == "zg":
            self.out.append(
                f'<rect x="{x}" y="{y}" width="{size}" height="{size}" rx="{size*0.26:.1f}" fill="#111"/>'
                f'<text x="{x + size/2}" y="{y + size*0.70}" text-anchor="middle" '
                f'class="logoText" style="font-size:{size*0.46:.1f}px">0G</text>'
            )

    def chainCard(self, x, y, w, h, kind, name, sub, body):
        self.out.append(f'<rect class="chainBox" x="{x}" y="{y}" width="{w}" height="{h}"/>')
        self.logo(kind, x + 20, y + 18, 44)
        self.text(x + 78, y + 38, name, "smallLabel")
        self.text(x + 78, y + 58, sub, "tiny")
        self.text(x + 20, y + 92, body, "body", dy=20)

    def logoBox(self, x, y, w, h, kinds, title, body, cls="plain"):
        """A component box that carries the marks of the chains it depends on."""
        self.out.append(f'<rect class="{cls}" x="{x}" y="{y}" width="{w}" height="{h}"/>')
        size = 26
        for i, k in enumerate(kinds):
            self.logo(k, x + 18 + i * (size + 8), y + 16, size)
        left = 18 + len(kinds) * (size + 8) if kinds else 18
        self.text(x + left, y + 35, title, "smallLabel")
        self.text(x + 18, y + 68, body, "tiny", dy=18)

    def save(self, path):
        self.out.append("</svg>")
        with open(path, "w") as f:
            f.write("\n".join(self.out))
        print("wrote", path)
