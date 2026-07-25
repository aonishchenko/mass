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
   * Endpoint returning the TEE attestation for a completed sealed response.
   * Unset => no attestation is fetched and NONE is claimed anywhere.
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
  /**
   * A TEE attestation, and ONLY a real one. Present when the provider actually
   * returned an attestation for this response; absent otherwise. We never
   * synthesize a value here — a proof chip that opens a self-issued id proves
   * nothing and costs us every other claim (MASS-specs A3).
   */
  attestationRef?: string;
  /**
   * What we can always state truthfully: which 0G endpoint and model produced
   * this answer, and the provider's own id for it. Verifiable in the sense that
   * it is the provider's record, not ours — but it is NOT an attestation, and
   * the UI must not describe it as one.
   */
  zgRunRef?: { endpoint: string; model: string; responseId: string | null };
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

  // RULE 2 is omitted when the brain is empty. Measured: with it present and no
  // chunks, "What is the capital of Peru?" answered "Lima"; without it, the
  // agent refused correctly. The citation rule and its worked example imply
  // there IS material to cite, which competes with the refusal rule — and the
  // refusal is the product's whole argument, so it must win when there is
  // nothing to cite.
  const citationRule = chunks.length
    ? "RULE 2: when your answer uses information from a brain chunk, you MUST " +
      "write the citation immediately after that information, in the form " +
      `${example} — copying the exact name and number from that chunk's ` +
      "brackets. Never cite a name or number not listed above.\n"
    : "";

  return {
    role: "system",
    content:
      "You are a team member built by a crew of humans.\n\nYOUR BRAIN:\n" +
      (brain || "(empty — you have not been taught anything yet)") +
      "\n\nRULE 1: answer ONLY from the brain above. If the answer is not in it, " +
      `reply with exactly this and nothing else:\n"${UNTAUGHT}"\n` +
      "Never answer from your own training data. Never pad with generic advice. " +
      "Never mention your training cutoff.\n" +
      citationRule +
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
/**
 * Framing for a build-path turn.
 *
 * The slot is CONTEXT, not a script. An earlier version told the agent to
 * "acknowledge what they told you, then name what is still missing", which
 * produced pure parroting — "I now understand that something should be
 * published… however I still need clarification on what needs to be published".
 * The crew got their own words read back instead of a colleague's thinking.
 *
 * The brain-only refusal is also off here on purpose. While the agent is being
 * defined it is a collaborator on its own spec, not the finished product
 * answering from what it was taught — refusing everything during setup makes it
 * useless exactly when the crew needs help. It becomes brain-only again the
 * moment the workflow is not driving the turn.
 */
export const interviewFraming = (slot: string): Msg => ({
  role: "system",
  content:
    "You are helping a crew build an AI team member. Right now you are working " +
    `on the "${slot}" part of it.\n\n` +
    "Respond the way a sharp colleague would: engage with the substance of what " +
    "they said, add something genuinely useful — a concrete suggestion, a risk " +
    "they missed, a worked example — and ask at most one follow-up question, " +
    "only if something important is actually missing.\n" +
    "Do NOT restate their message back to them. Do NOT say \"I now understand\". " +
    "Do NOT cite anyone. Do not claim anything is saved.\n" +
    "Be brief: a few sentences.",
});

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
  onToken: (token: string) => void,
  /**
   * Build-path step being answered. REPLACES the brain-only system prompt
   * rather than being appended to it: appending left "answer only from the
   * brain, otherwise refuse" in place, and a small model obeys the first strong
   * rule it reads — so the agent refused the very answer it had asked for.
   */
  interviewSlot?: string
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
  /**
   * An untaught agent refuses deterministically, without asking the model.
   *
   * "It knows only what this crew taught it" is the product's central claim, so
   * it cannot rest on a small model obeying a prompt rule. Measured against
   * qwen2.5-omni, the identical prompt refused on one run and answered "the
   * capital of Peru is Lima" on the next — the wording was never the problem,
   * the non-determinism was.
   *
   * With an empty brain there is nothing to answer FROM, so there is nothing to
   * ask. Once chunks exist the model does the work and the prompt rules apply.
   * Interview turns are exempt: they are answers, not questions.
   */
  if (!interviewSlot && brainChunks.length === 0) {
    for (const word of UNTAUGHT.split(" ")) onToken(word + " ");
    return { text: UNTAUGHT, sealed };
  }

  const full = interviewSlot
    ? [interviewFraming(interviewSlot), ...messages]
    : [citationSystemPrompt(brainChunks), ...messages];

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
  // The provider's own id for this response — what an attestation is fetched
  // against, and the only run identifier we are entitled to quote.
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

  // What we can always say truthfully about this run.
  const zgRunRef = { endpoint: env.ZG_ROUTER_URL, model, responseId };

  // And the receipt — only if the provider actually gave us one. Previously
  // this returned `att_<random uuid>` and the UI presented it as a TEE
  // attestation: a sticker reading "certified" that we printed ourselves.
  const attestationRef = sealed ? await fetchAttestation(env, responseId) : undefined;

  return { text, sealed, attestationRef, zgRunRef };
}

/**
 * Ask the provider for the TEE attestation of a completed sealed response.
 *
 * Returns undefined when the provider offers none, when the endpoint is not
 * configured, or on any error. There is deliberately no fallback value: absence
 * of proof must look like absence of proof.
 */
async function fetchAttestation(
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
    const ref = body.attestation ?? body.attestationRef ?? body.quote ?? body.signature;
    return typeof ref === "string" && ref ? ref : undefined;
  } catch {
    return undefined;
  }
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
