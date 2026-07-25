#!/usr/bin/env node
/**
 * Zero-hex doctrine check (ENS-TASK Req 1).
 *
 * The ENS judge test is "do I ever see a hex address in this demo?" — the answer
 * must be no. This scans our UI source for any 0x-prefixed hex literal of
 * address-ish length. Identities must render as ENS names, never hex.
 *
 * Run: node scripts/grep-hex.mjs   (exits non-zero on any hit)
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "web/src";
const RX = /0x[0-9a-fA-F]{6,}/g;
const hits = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      walk(p);
      continue;
    }
    if (!/\.(tsx?|css|html)$/.test(p)) continue;
    readFileSync(p, "utf8")
      .split("\n")
      .forEach((line, i) => {
        const m = line.match(RX);
        if (m) hits.push(`  ${p}:${i + 1}: ${m.join(", ")}  |  ${line.trim().slice(0, 90)}`);
      });
  }
}

walk(ROOT);

if (hits.length) {
  console.error("✗ zero-hex check FAILED — hex address literals in UI source:");
  for (const h of hits) console.error(h);
  process.exit(1);
}
console.log("✓ zero-hex check passed — no hex addresses in web/src");
