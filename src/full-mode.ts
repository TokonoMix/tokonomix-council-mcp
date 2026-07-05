import { validateAndConvertImages, buildUserContent } from './image-validation.js';
import { normalizeContext, tokonomixFetch, authHeaders } from './http.js';
import { skillVersionTrailer } from './skill.js';
import { renderFeedbackInvite, type FeedbackInvite } from './render.js';

// ─── mode:"full" — client-side composition (Option A in SPEC-…full-mode) ────
// Returns the full proposer answers + the judge's per-proposer agree/disagree
// reasoning + a clear conclusion in a single MCP response. Two underlying API
// calls, both billed by the backend exactly as normal raw passthroughs.

interface RawProposer {
  model: string;
  latency_ms?: number;
  input_tokens?: number;
  output_tokens?: number;
  cost_micros?: number;
  content?: string | null;
  error?: { code: string; message: string };
}

interface FullModeRawResponse {
  choices: Array<{ message: { content: string } }>;
  x_council: {
    per_model: RawProposer[];
    charged_credits: number;
    feedback_invite?: FeedbackInvite | null;
  };
}

interface FullModeJudgeResponse {
  model: string;
  choices: Array<{ message: { content: string } }>;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  x_council: { charged_credits: number };
}

const FULL_MODE_DEFAULT_JUDGE = 'claude-sonnet-4-6';

const FULL_MODE_JUDGE_SYSTEM = [
  'You are a synthesis judge. You have received responses from multiple AI proposers.',
  '',
  'Your task:',
  '1. Read all proposer responses carefully.',
  '2. For each proposer, explicitly state: what you agree with, what you disagree with, and why.',
  '3. Synthesize the strongest answer based on your analysis.',
  '4. End with a clear, definitive conclusion that directly answers the original question.',
  '',
  'Structure your response exactly as follows (use these literal markdown headings):',
  '',
  '### Reasoning',
  'For each proposer (named "Proposer 1", "Proposer 2", …):',
  '- What you agree with',
  '- What you disagree with',
  '- Why',
  '(Minimum 2-3 sentences per proposer.)',
  '',
  '### Conclusion',
  'The definitive answer to the original question. Direct, 1-5 sentences. No hedging unless the proposers genuinely converge on uncertainty.',
].join('\n');

function parseJudgeOutput(judgeContent: string): { reasoning: string; conclusion: string } {
  // Robust parse: look for explicit headings, fall back to splitting on
  // "Conclusion" if the model lost the markdown framing.
  const conclusionMatch = judgeContent.match(/###\s*Conclusion\s*\n([\s\S]*?)$/i);
  if (conclusionMatch) {
    const reasoningPart = judgeContent.slice(0, conclusionMatch.index ?? 0);
    const cleanedReasoning = reasoningPart
      .replace(/###\s*Reasoning\s*\n?/i, '')
      .trim();
    return {
      reasoning: cleanedReasoning,
      conclusion: conclusionMatch[1].trim(),
    };
  }
  // Fallback heuristic — split on a "Conclusion" heading if the markdown framing broke.
  const fallback = judgeContent.split(/\n#+\s*Conclusion/i);
  if (fallback.length >= 2) {
    return { reasoning: fallback[0].trim(), conclusion: fallback.slice(1).join('').trim() };
  }
  return { reasoning: judgeContent.trim(), conclusion: '' };
}

function buildJudgePrompt(originalQuestion: string, proposers: RawProposer[]): string {
  const labelled = proposers
    .filter((p) => p.content && !p.error)
    .map((p, i) => `## Proposer ${i + 1}: ${p.model}\n\n${p.content}`)
    .join('\n\n');
  return [
    `Original user question:\n\n${originalQuestion}\n\n---\n`,
    `Proposer responses:\n\n${labelled}\n\n---\n`,
    `Now produce your synthesis following the structure in your system prompt exactly.`,
  ].join('');
}

function buildFullModeReadableContent(
  proposers: RawProposer[],
  judgeModel: string,
  reasoning: string,
  conclusion: string,
): string {
  const proposerSections = proposers
    .filter((p) => p.content && !p.error)
    .map((p, i) => `## Proposer ${i + 1}: ${p.model}\n\n${p.content}`)
    .join('\n\n');
  const errors = proposers
    .filter((p) => p.error)
    .map((p) => `- ${p.model}: ERROR (${p.error?.code ?? '?'})`)
    .join('\n');
  const errorBlock = errors ? `\n\n_Proposer errors:_\n${errors}` : '';
  return [
    proposerSections,
    errorBlock,
    `\n\n---\n\n## Judge: ${judgeModel}\n\n### Reasoning\n\n${reasoning}\n\n### Conclusion\n\n${conclusion}`,
  ].join('');
}

export async function runFullMode(a: Record<string, unknown>): Promise<{
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}> {
  const prompt = String(a.prompt ?? '');
  if (!prompt) throw new Error('prompt is required');
  const judgeModel =
    typeof a.judge_model === 'string' && a.judge_model
      ? a.judge_model
      : FULL_MODE_DEFAULT_JUDGE;

  // ── Step 1 — raw fan-out to harvest proposer content.
  // Images are passed through to the fan-out call so vision-capable proposers
  // receive them. The judge step uses text-only (the proposer answers are text).
  const imageParts = validateAndConvertImages(a.images);
  const userContent = buildUserContent(prompt, imageParts);

  const messages: Array<{ role: string; content: unknown }> = [];
  if (typeof a.system === 'string' && a.system) {
    messages.push({ role: 'system', content: a.system });
  }
  messages.push({ role: 'user', content: userContent });

  const rawBody: Record<string, unknown> = {
    model: 'tokonomix-consensus',
    messages,
    x_council: { mode: 'raw' },
  };
  if (Array.isArray(a.models) && a.models.length > 0) {
    (rawBody.x_council as Record<string, unknown>).models = a.models;
  }
  const fullCtx = normalizeContext(a.context);
  if (fullCtx) (rawBody.x_council as Record<string, unknown>).context = fullCtx;
  if (typeof a.max_tokens === 'number') rawBody.max_tokens = a.max_tokens;

  const rawResultUnknown = await tokonomixFetch('/chat/completions', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(rawBody),
  });
  const rawResult = rawResultUnknown as FullModeRawResponse;
  const proposers = rawResult.x_council.per_model ?? [];

  // Inline content into proposers (raw mode embeds answers in choices[0],
  // but cleaner to read each model's content from per_model when the backend
  // populates it; raw-mode response includes content in choices array
  // serialised JSON — parse if needed).
  // The backend's raw mode actually stuffs all proposer contents into
  // choices[0].message.content as a JSON-encoded array of {modelId,content}.
  // Decode and merge into per_model entries.
  try {
    const choiceContent = rawResult.choices?.[0]?.message?.content ?? '';
    const parsed = JSON.parse(choiceContent) as Array<{ modelId?: string; content?: string }>;
    if (Array.isArray(parsed)) {
      for (const proposer of proposers) {
        const match = parsed.find((p) => p.modelId === proposer.model);
        if (match && match.content) proposer.content = match.content;
      }
    }
  } catch {
    // Not JSON-shaped — leave proposer.content as whatever the backend set
    // (newer backends embed content directly in per_model).
  }

  const usableProposers = proposers.filter((p) => p.content && !p.error);
  if (usableProposers.length === 0) {
    return {
      content: [
        {
          type: 'text',
          text:
            'mode "full" fan-out returned no usable proposer content. ' +
            'All proposers errored or were empty. Falling back is not possible at this point — retry with fewer or different models.',
        },
        skillVersionTrailer(),
      ],
      isError: true,
    };
  }

  // ── Step 2 — single-model judge call.
  const judgePromptText = buildJudgePrompt(prompt, proposers);
  const judgeBody: Record<string, unknown> = {
    model: judgeModel,
    messages: [
      { role: 'system', content: FULL_MODE_JUDGE_SYSTEM },
      { role: 'user', content: judgePromptText },
    ],
  };
  // Auto-sized judge budget (2026-06-06). The judge synthesizes ALL proposer
  // answers into one structured result, so its output budget scales with the
  // proposer count rather than a flat default (the old flat 8192 truncated large
  // multi-proposer syntheses). Mirrors lib/api/synthesizer/judge-budget.ts — the
  // formula is inlined because the MCP server is a separate package. The backend
  // clamps to MAX_TOKENS_CEILING (16384) regardless; for more, batch/split.
  const JUDGE_BASE = 4096, JUDGE_PER_PROPOSER = 2048, JUDGE_MIN = 4096, JUDGE_MAX = 16384;
  const autoJudgeBudget = Math.min(JUDGE_MAX, Math.max(JUDGE_MIN, JUDGE_BASE + JUDGE_PER_PROPOSER * proposers.length));
  // A caller-supplied max_tokens may raise the floor but never lowers the auto
  // budget (capped at the backend ceiling).
  judgeBody.max_tokens = typeof a.max_tokens === 'number'
    ? Math.min(JUDGE_MAX, Math.max(autoJudgeBudget, a.max_tokens as number))
    : autoJudgeBudget;

  let judgeResult: FullModeJudgeResponse;
  try {
    judgeResult = (await tokonomixFetch('/chat/completions', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(judgeBody),
    })) as FullModeJudgeResponse;
  } catch (err) {
    // Graceful fallback to raw-mode behaviour per acceptatiecriterium 6:
    // "Bij judge-fout: graceful fallback naar `raw` (bestaand gedrag behouden)."
    const proposerSections = usableProposers
      .map((p, i) => `## Proposer ${i + 1}: ${p.model}\n\n${p.content}`)
      .join('\n\n');
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [
        { type: 'text', text: proposerSections },
        {
          type: 'text',
          text:
            `\n---\nJudge call failed (${message.slice(0, 200)}). ` +
            `Returning proposer content only — treat this response as mode:"raw".`,
        },
        skillVersionTrailer(),
      ],
    };
  }

  const judgeContent = judgeResult.choices?.[0]?.message?.content ?? '';
  const { reasoning, conclusion } = parseJudgeOutput(judgeContent);

  // ── Step 3 — combine into the spec-defined response shape.
  const readableContent = buildFullModeReadableContent(
    proposers,
    judgeResult.model ?? judgeModel,
    reasoning,
    conclusion,
  );

  // cost_micros = raw provider cost-of-goods (pre-markup), 1 cent = 10_000 micros.
  // This is NOT the charged amount (see `Total charged` below for that).
  const proposerLines = proposers.map((p) => {
    if (p.error) return `${p.model}: ERROR (${p.error.code})`;
    return `${p.model}: ${((p.cost_micros ?? 0) / 10_000).toFixed(2)}c provider cost · ${p.latency_ms ?? '?'}ms`;
  }).join('\n');

  const totalCharged =
    (rawResult.x_council?.charged_credits ?? 0) + (judgeResult.x_council?.charged_credits ?? 0);

  const fullModeInviteText = renderFeedbackInvite(
    rawResult.x_council?.feedback_invite,
    `${totalCharged} cents in totaal`,
  );

  return {
    content: [
      { type: 'text', text: readableContent },
      {
        type: 'text',
        text:
          `\n---\nMode: full · Total charged: ${totalCharged} cents (raw: ${rawResult.x_council?.charged_credits ?? 0}c + judge: ${judgeResult.x_council?.charged_credits ?? 0}c)\n` +
          `Judge: ${judgeResult.model ?? judgeModel} · ` +
          `Proposers:\n${proposerLines}` +
          fullModeInviteText,
      },
      skillVersionTrailer(),
    ],
  };
}
