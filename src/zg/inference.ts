/**
 * Inference adapter — MASS-specs C3, shared-session-spec §6.
 *
 * One adapter, lane is a parameter. Both lanes start on the 0G Router
 * (OpenAI-compatible); canonical moves to the direct-broker path once latency is
 * measured (§8.3).
 */

import type { BrainChunk, Lane } from "../core/types.js";

export class SealedUnavailable extends Error {
  constructor(provider: string) {
    super(`sealed inference unavailable on ${provider}`);
    this.name = "SealedUnavailable";
  }
}

export interface InferenceEnv {
  ZG_ROUTER_URL: string;
  /** Router key created with trust mode "Standard" — the draft lane. */
  ZG_ROUTER_KEY?: string;
  /**
   * Router key created with trust mode "Private (TEE enclave)" — the canonical
   * lane. A key's trust mode is fixed at creation, so the lane split is enforced
   * by using two keys rather than one (§6).
   */
  ZG_ROUTER_KEY_SEALED?: string;
  ZG_DRAFT_MODEL: string;
  ZG_CANONICAL_MODEL: string;
  /** "true" => canonical is genuinely sealed. "required" => canonical throws rather than degrade. */
  ZG_SEALED?: string;
  /**
   * Endpoint that returns the TEE attestation for a completed sealed response.
   * Unset => no attestation is fetched and NONE is reported. We never
   * synthesize one (MASS-specs A3).
   */
  ZG_ATTESTATION_URL?: string;
}

/** Draft and canonical authenticate with different keys — see ZG_ROUTER_KEY_SEALED. */
const keyFor = (env: InferenceEnv, lane: Lane): string =>
  (lane === "canonical" ? env.ZG_ROUTER_KEY_SEALED ?? env.ZG_ROUTER_KEY : env.ZG_ROUTER_KEY) ?? "";

export interface Msg {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface RunResult {
  text: string;
  attestationRef?: string;
  /** False => the UI must show the honesty banner (MASS-specs Part F copy). */
  sealed: boolean;
}

/**
 * C2: the canonical lane MUST require inline citation and forbid invention.
 * Draft gets none of this — an unattested run must not attribute credit (§6.2).
 */
export function citationSystemPrompt(chunks: BrainChunk[]): Msg {
  const brain = chunks
    .map((c) => `[${c.contributor} #${c.contribNumber}] ${c.content}`)
    .join("\n");

  // Wording matters more than it looks. Angle-bracket placeholders like
  // <contributor> get echoed verbatim by smaller models, and putting the rule
  // before the brain makes it ignored. Rule-after-brain with one concrete
  // example was the only variant that cited correctly AND stayed silent on
  // questions the brain does not cover (measured against qwen2.5-omni).
  const example = chunks[0]
    ? `(per ${chunks[0].contributor}'s contribution #${chunks[0].contribNumber})`
    : "(per alice's contribution #1)";

  return {
    role: "system",
    content:
      "You are a team member built by a crew of humans.\n\nYOUR BRAIN:\n" +
      (brain || "(empty)") +
      "\n\nRULE 1: answer ONLY from the brain above. If the answer is not in it, " +
      `reply with exactly this and nothing else:\n"${UNTAUGHT}"\n` +
      "Never answer from your own training data. Never pad with generic advice. " +
      "Never mention your training cutoff.\n" +
      "RULE 2: when your answer uses information from a brain chunk, you MUST " +
      "write the citation immediately after that information, in the form " +
      `${example} — copying the exact name and number from that chunk's ` +
      "brackets. Never cite a name or number not listed above.\n" +
      "RULE 3: be brief. Answer in a few sentences unless asked for more.",
  };
}

/**
 * The exact refusal. The UI matches on this string to offer "Teach it now", so
 * it is a contract between the prompt and the client — change both together.
 *
 * This sentence is also the product's whole argument in one line: the agent
 * knows what this crew taught it, and nothing else.
 */
export const UNTAUGHT =
  "I haven't been taught that yet. Teach me and I'll know it next time.";

/**
 * Capped on purpose. Uncapped, the model answered a simple question with a
 * ~500-word generic essay that filled the screen and buried the citation —
 * which is the one thing the demo exists to show.
 */
const MAX_TOKENS = 500;

const bodyFor = (model: string, messages: Msg[], stream: boolean) =>
  JSON.stringify({ model, messages, stream, max_tokens: MAX_TOKENS });

/**
 * Fetches the TEE attestation for a completed sealed response.
 *
 * HONESTY RULE (MASS-specs A3): this returns the provider's attestation or
 * NOTHING. It must never invent a reference — a proof chip that opens a
 * fabricated id is worse than no chip at all, because it claims a verification
 * that never happened.
 */
export async function getAttestation(
  env: InferenceEnv,
  responseId: string | null
): Promise<string | undefined> {
  if (!env.ZG_ATTESTATION_URL || !responseId) return undefined;
  try {
    const res = await fetch(
      `${env.ZG_ATTESTATION_URL.replace(/\/$/, "")}/${encodeURIComponent(responseId)}`,
      { headers: { authorization: `Bearer ${env.ZG_ROUTER_KEY_SEALED ?? ""}` } }
    );
    if (!res.ok) return undefined;
    const body = (await res.json()) as Record<string, unknown>;
    // Accept the common shapes; anything else means we did not get an
    // attestation, so we report none.
    const ref =
      body.attestation ?? body.attestationRef ?? body.quote ?? body.signature ?? body.id;
    return typeof ref === "string" && ref ? ref : undefined;
  } catch {
    // A failed attestation fetch is reported as "no attestation", never as a
    // successful one.
    return undefined;
  }
}

/**
 * Streams tokens through `onToken` and resolves with the full text.
 *
 * The full text matters: `draft.completed` carries it, and without it the log is
 * unreplayable (§4.3). Tokens themselves are wire-only and never logged.
 */
export async function runInference(
  env: InferenceEnv,
  lane: Lane,
  messages: Msg[],
  brainChunks: BrainChunk[],
  onToken: (token: string) => void
): Promise<RunResult> {
  // Sealed only if a TEE-enclave key actually exists — a config flag alone must
  // never be enough to claim attestation (A3 honesty rule).
  const sealed =
    lane === "canonical" && env.ZG_SEALED === "true" && !!env.ZG_ROUTER_KEY_SEALED;

  if (lane === "canonical" && !sealed) {
    // Honest degradation, not a silent downgrade: the caller surfaces the banner
    // and no attestationRef is produced. See §6.3.
    if (env.ZG_SEALED === "required") throw new SealedUnavailable("0g-router");
  }

  const model = lane === "canonical" ? env.ZG_CANONICAL_MODEL : env.ZG_DRAFT_MODEL;
  // BOTH lanes answer from the brain only. An agent that answers from its
  // training data in quick mode and from the crew's knowledge in careful mode
  // is two different colleagues, and the refuse-teach-answer beat only works if
  // "I haven't been taught that" can happen in the mode people actually use.
  const full = [citationSystemPrompt(brainChunks), ...messages];

  const res = await fetch(`${env.ZG_ROUTER_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${keyFor(env, lane)}`,
    },
    body: bodyFor(model, full, true),
  });

  if (!res.ok || !res.body) {
    throw new Error(`inference failed ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }

  let text = "";
  // The upstream response id is what an attestation is fetched against, so it
  // is captured from the stream rather than invented afterwards.
  let responseId: string | null = null;
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += value;

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") continue;
      try {
        const frame = JSON.parse(data);
        if (!responseId && typeof frame?.id === "string") responseId = frame.id;
        const token = frame?.choices?.[0]?.delta?.content;
        if (typeof token === "string" && token) {
          text += token;
          onToken(token);
        }
      } catch {
        // Ignore keep-alive and non-JSON frames.
      }
    }
  }

  // Only a real, fetched attestation is reported. When the provider gives us
  // none, the run is still sealed (it used the TEE key) but carries no proof
  // reference, and the UI shows that honestly.
  const attestationRef = sealed ? await getAttestation(env, responseId) : undefined;
  return { text, sealed, attestationRef };
}

/**
 * Harvest candidate extraction (§7.5.2), on the draft lane.
 * Reads human `instruct` text ONLY — never agent answers (§7.5.3).
 */
export async function extractCandidates(
  env: InferenceEnv,
  humanLines: { eventId: string; seat: string; text: string }[]
): Promise<{ eventId: string; seat: string; text: string }[]> {
  if (humanLines.length === 0) return [];

  const numbered = humanLines.map((l, i) => `${i + 1}. ${l.text}`).join("\n");
  const messages: Msg[] = [
    {
      role: "system",
      // Measured against qwen2.5-omni on a real transcript. Two earlier phrasings
      // returned [] for everything because "create a skill for X" reads as a task
      // request — but in this product, defining a skill IS the teaching. The
      // "would it be a better team member?" test is what fixed it.
      //
      // Tuned for PRECISION over recall: a missed line costs one click on
      // "Teach this" beside the message, whereas a false positive is noise in
      // the review, which is the thing harvest exists to remove.
      content:
        "Humans are teaching an AI team member. Below is what they said.\n\n" +
        'For each line ask: "if the agent remembered this forever, would it be a ' +
        'better team member?"\n' +
        "- Yes -> keep it. Skill definitions, output formats, rules, standards, " +
        'preferences all qualify, even when phrased as a request ("create a skill ' +
        'for...", "the output should be...").\n' +
        "- No -> drop it. Questions, requests for information, and chit-chat teach " +
        "nothing.\n\n" +
        "Rewrite each kept line as a standalone instruction.\n" +
        'Reply with ONLY a JSON array: [{"n": <number>, "text": "<statement>"}]. ' +
        "No prose.",
    },
    { role: "user", content: numbered },
  ];

  const res = await fetch(`${env.ZG_ROUTER_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${keyFor(env, "draft")}`,
    },
    body: bodyFor(env.ZG_DRAFT_MODEL, messages, false),
  });

  if (!res.ok) throw new Error(`extraction failed ${res.status}`);

  const raw = (await res.json<any>())?.choices?.[0]?.message?.content ?? "[]";
  const match = raw.match(/\[[\s\S]*\]/);
  const picked: { n: number; text: string }[] = JSON.parse(match ? match[0] : "[]");

  return picked
    .map((p) => {
      const src = humanLines[p.n - 1];
      return src ? { eventId: src.eventId, seat: src.seat, text: p.text || src.text } : null;
    })
    .filter((x): x is { eventId: string; seat: string; text: string } => x !== null);
}
