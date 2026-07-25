/**
 * Non-deterministic values are resolved HERE, before an event is emitted, and
 * baked into the payload. `apply()` must never call any of this — §4.2.
 */

/** Stable stringify so the same payload always hashes to the same digest. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const body = Object.keys(obj)
    .sort()
    .filter((k) => obj[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`)
    .join(",");
  return `{${body}}`;
}

export async function sha256(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const payloadHash = (payload: unknown): Promise<string> =>
  sha256(canonicalJson(payload ?? null));

export const newId = (prefix: string): string =>
  `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
