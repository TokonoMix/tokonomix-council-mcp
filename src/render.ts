/**
 * The human-relay sub-block of a feedback_invite (present per-round when the
 * account's cadence allows + a human may be in the session). The MCP renderer
 * MUST surface this — without it the host agent never sees the cue to ask its
 * human, and the human-feedback channel stays silently empty.
 */
export interface FeedbackRelayHuman {
  submit_to: string;
  ask: string;
  choices: string;
  rule: string;
}

export interface FeedbackInvite {
  rate_with: string;
  request_id: string;
  message: string;
  share_findings?: boolean;
  reward: string;
  relay_human?: FeedbackRelayHuman | null;
}

/**
 * Machine-readable council verdict (consensus-integrity #03). Present in
 * `x_council.verdict` ONLY when the gateway flag `council_structured_verdict` is
 * ON; DORMANT today, so this renderer is inert until the gateway emits the block.
 * `overall`/`issues` are the independent judge's own assessment; `proposers`/
 * `judge` are stamped server-side by the gateway (never self-reported).
 */
export interface CouncilVerdictBlock {
  overall: 'pass' | 'concerns' | 'error';
  issues: Array<{
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    status: 'open' | 'resolved';
    title: string;
    file?: string;
  }>;
  proposers: string[];
  judge: string;
}

/**
 * Render the structured verdict into host-agent-visible tool text. Returns an
 * empty string when the block is absent (flag OFF) so the tool output is
 * byte-identical to today while the gateway feature is dormant.
 */
export function renderCouncilVerdict(verdict: CouncilVerdictBlock | null | undefined): string {
  if (!verdict || typeof verdict.overall !== 'string') return '';
  const issues = Array.isArray(verdict.issues) ? verdict.issues : [];
  const lines = issues.map(
    (i) => `  - [${i.severity}/${i.status}] ${i.title}${i.file ? ` (${i.file})` : ''}`,
  );
  const body =
    issues.length > 0 ? `\nIssues (judge):\n${lines.join('\n')}` : '\nIssues (judge): none';
  return (
    `\n---\nCouncil verdict: ${verdict.overall} · judge: ${verdict.judge} · ` +
    `proposers: ${verdict.proposers.join(', ')}${body}`
  );
}

/** One proposer's line in the billing breakdown. `cost_micros` is the RAW
 *  provider cost-of-goods (pre-markup), never what the caller is charged. */
export interface ProposerResult {
  model: string;
  cost_micros?: number;
  error?: { code: string; message: string };
}

/** Render the per-proposer breakdown, including the ERROR path for a proposer
 *  that failed. Extracted from index.ts so the response-parsing is unit-tested
 *  (review 4.6). 1 cent = 10_000 micros. */
export function renderProposerBreakdown(perModel: ProposerResult[] | undefined): string {
  const list = Array.isArray(perModel) ? perModel : [];
  return list
    .map((m) =>
      m.error
        ? `${m.model}: ERROR (${m.error.code})`
        : `${m.model}: ${((m.cost_micros ?? 0) / 10_000).toFixed(2)}c provider cost`,
    )
    .join('\n');
}

/** Members that did NOT actually take part in this consensus — dropped for a
 *  non-vision capability, a proposer timeout, or context truncation. The gateway
 *  already reports these in `x_council.skipped` for the vision case; surfacing
 *  them here (review 4.10) keeps "consensus" honest: the verdict reflects only
 *  the members that returned, and the caller can see when it was fewer than they
 *  asked for. Returns '' when nothing was skipped (byte-identical to before). */
export function renderSkipped(skipped: unknown): string {
  const list = Array.isArray(skipped) ? skipped : [];
  const items = list
    .map((s) => {
      if (typeof s === 'string') return s;
      if (s && typeof s === 'object') {
        const o = s as { model?: unknown; reason?: unknown };
        const model = typeof o.model === 'string' && o.model ? o.model : '(unknown)';
        const reason = typeof o.reason === 'string' && o.reason ? o.reason : '';
        return reason ? `${model} (${reason})` : model;
      }
      return '';
    })
    .filter((x) => x.length > 0);
  if (items.length === 0) return '';
  return (
    `\n⚠️ Not counted in this consensus (${items.length}): ${items.join(', ')} — the ` +
    `verdict reflects only the members that actually returned.`
  );
}

/** The judge/synthesis step is hard-capped at this many output tokens regardless
 *  of the caller's max_tokens (per the gateway contract). Above it the synthesis
 *  can truncate silently, which is exactly the high-stakes failure 4.10 warns of. */
export const JUDGE_MAX_OUTPUT_TOKENS = 8192;

/** Client-side advisory when max_tokens is set beyond the judge's synthesis cap,
 *  so a caller does not silently lose the tail of a large structured answer
 *  (review 4.10). Returns '' when max_tokens is unset or within the cap. */
export function maxTokensAdvisory(maxTokens: unknown): string {
  if (typeof maxTokens !== 'number' || maxTokens <= JUDGE_MAX_OUTPUT_TOKENS) return '';
  return (
    `\n⚠️ max_tokens=${maxTokens} exceeds the judge's ${JUDGE_MAX_OUTPUT_TOKENS}-token synthesis ` +
    `cap — the synthesis step can truncate silently. Split the request or keep max_tokens at or ` +
    `below ${JUDGE_MAX_OUTPUT_TOKENS} for large structured outputs.`
  );
}

/**
 * Render a feedback_invite into the host-agent-visible tool text. TWO channels,
 * both wanted, neither blocks the other:
 *   1. the agent's OWN rating (always present when an invite is emitted), and
 *   2. the relayed HUMAN verdict (present only when `relay_human` is set — the
 *      per-round cadence cue).
 *
 * The agent only ever sees this rendered TEXT (never the raw JSON), so anything
 * omitted here is invisible to it. The previous renderer dropped `relay_human`
 * entirely, so agents working with a human present never got asked to relay —
 * the channel stayed empty even though the skill told them to read a field they
 * could not see. We now render the human ask + choices + submit endpoint, and
 * explicitly instruct the agent to summarise the result + cost to its human
 * first. `chargedSummary` (e.g. "12 cents") is woven into that instruction so
 * the agent has the figure to relay without re-deriving it.
 */
export function renderFeedbackInvite(
  invite: FeedbackInvite | null | undefined,
  chargedSummary: string,
): string {
  if (!invite) return '';
  let text =
    `\n📋 Feedback requested — two separate channels, do both:` +
    `\n1) YOUR agent rating (no approval needed): call ` +
    `${invite.rate_with}(request_id="${invite.request_id}", score=...) — ${invite.message} ${invite.reward}`;
  if (invite.relay_human) {
    text +=
      `\n2) YOUR HUMAN — a SEPARATE required step (finishing channel 1 is NOT done). Only skip it if there is no human in this session, or they don't respond. Keep it short/casual and never block your task on it — but don't skip it just because channel 1 is done. Follow the steps in order:` +
      `\n   STEP A — first show the human the council result and summarise what it cost (${chargedSummary}). NEVER ask before they have seen the result.` +
      `\n   STEP B — then ask this ONE question, in THEIR language, before you reveal your own verdict (don't steer them toward an answer):` +
      `\n     "${invite.relay_human.ask}"` +
      `\n     ${invite.relay_human.choices}` +
      `\n   STEP C — relay ONLY what the human actually said to: ${invite.relay_human.submit_to}` +
      `\n     ${invite.relay_human.rule}` +
      `\n     NEVER invent an answer on the human's behalf. "No approval needed" applies only to YOUR rating in channel 1 — never to the human's answer. No human or no response? POST state:"skipped_explicit" or move on.`;
  }
  return text;
}
