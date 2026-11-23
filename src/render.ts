import { maskApiKey } from './credentials.js';
import { TokonomixApiError } from './http.js';

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
  // INT-2327: `abstained` is a first-class verdict — the council declined to
  // answer because it could not adequately ground its review. The host agent must
  // treat it as a NON-BLOCKING signal (not a pass, not a hard error): re-run with
  // the missing material rather than trusting an ungrounded answer.
  overall: 'pass' | 'concerns' | 'error' | 'abstained';
  issues: Array<{
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    status: 'open' | 'resolved';
    title: string;
    file?: string;
  }>;
  /** INT-2327: present only when overall === 'abstained'. */
  grounds?: {
    reason: 'retrieval_incomplete' | 'insufficient_grounding';
    missing: string[];
  };
  proposers: string[];
  judge: string;
}

/**
 * Render the structured verdict into host-agent-visible tool text. Returns an
 * empty string when the block is absent (flag OFF) so the tool output is
 * byte-identical to today while the gateway feature is dormant. Defensive on
 * every field — a malformed block (incl. an abstained one with no grounds) must
 * render, never crash.
 */
export function renderCouncilVerdict(verdict: CouncilVerdictBlock | null | undefined): string {
  if (!verdict || typeof verdict.overall !== 'string') return '';
  const issues = Array.isArray(verdict.issues) ? verdict.issues : [];
  const lines = issues.map(
    (i) => `  - [${i.severity}/${i.status}] ${i.title}${i.file ? ` (${i.file})` : ''}`,
  );
  const body =
    issues.length > 0 ? `\nIssues (judge):\n${lines.join('\n')}` : '\nIssues (judge): none';
  // INT-2327: surface the abstention grounds so the agent knows WHY the council
  // declined and WHAT to supply on a re-run.
  let abstain = '';
  if (verdict.overall === 'abstained') {
    const g = verdict.grounds;
    const reason = g && typeof g.reason === 'string' ? g.reason : 'ungrounded';
    const missing = g && Array.isArray(g.missing) ? g.missing.filter((m) => typeof m === 'string') : [];
    const missingText = missing.length > 0 ? ` · missing: ${missing.join(', ')}` : '';
    abstain =
      `\n⚠️ The council ABSTAINED (not enough grounding to answer): ${reason}${missingText}. ` +
      `This is a deliberate outcome, not a failure — re-run with the missing material attached ` +
      `rather than trusting an ungrounded answer.`;
  }
  const proposers = Array.isArray(verdict.proposers) ? verdict.proposers : [];
  return (
    `\n---\nCouncil verdict: ${verdict.overall} · judge: ${verdict.judge} · ` +
    `proposers: ${proposers.join(', ')}${abstain}${body}`
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

/** A model the caller named was not the model that answered. The gateway has
 *  reported this in `x_council.substitutions` since INT-1720, and neither MCP
 *  tool has ever shown it — so asking for `claude-opus-5` and being served
 *  `ovh/Qwen3.5-397B-A17B` looked identical to getting what you asked for. That
 *  happened 12 times in the 30 days to 2026-09-03. Returns '' when nothing was
 *  substituted (byte-identical to before). */
export function renderSubstitutions(substitutions: unknown): string {
  const list = Array.isArray(substitutions) ? substitutions : [];
  const items = list
    .map((s) => {
      if (!s || typeof s !== 'object') return '';
      const o = s as { for?: unknown; model?: unknown; ok?: unknown; reason?: unknown };
      const asked = typeof o.for === 'string' && o.for ? o.for : '(unknown)';
      const got = typeof o.model === 'string' && o.model ? o.model : '(unknown)';
      const reason = typeof o.reason === 'string' && o.reason ? ` (${o.reason})` : '';
      const outcome = o.ok === false ? ' — which also failed' : '';
      return `${asked}${reason} → ${got}${outcome}`;
    })
    .filter((x) => x.length > 0);
  if (items.length === 0) return '';
  return (
    `\n⚠️ Not the model you asked for (${items.length}): ${items.join(', ')} — ` +
    `the answer above came from the substitute, not the model you named.`
  );
}

/** Top-level `warnings[]` from the gateway. The gateway puts a degradation here
 *  precisely so a client that does not parse `x_council` still sees it; dropping
 *  them in the renderer would reintroduce the silence they exist to prevent.
 *  Returns '' when there are none. */
export function renderWarnings(warnings: unknown): string {
  const list = Array.isArray(warnings) ? warnings : [];
  const items = list
    .map((w) => {
      if (!w || typeof w !== 'object') return '';
      const o = w as { code?: unknown; message?: unknown };
      const message = typeof o.message === 'string' && o.message ? o.message : '';
      const code = typeof o.code === 'string' && o.code ? o.code : '';
      if (!message) return code;
      return code ? `[${code}] ${message}` : message;
    })
    .filter((x) => x.length > 0);
  if (items.length === 0) return '';
  return `\n⚠️ ${items.join('\n⚠️ ')}`;
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

/** Inputs for the tokonomix_onboard_verify success message. */
export interface OnboardVerifySuccess {
  email: string;
  /** The real key — used ONLY to derive a masked identifier; never rendered. */
  rawKey: string;
  creditsEur: string;
  approxCalls: number;
  credentialsFile: string;
  dashboardUrl: string;
  setPasswordUrl: string;
  alreadyExisted: boolean;
}

/**
 * Render the onboard_verify tool result.
 *
 * Deliberately prints a MASKED key (2026-08-03 scan F18). An MCP tool result is
 * appended to the conversation, sent verbatim to the model provider on the next
 * turn, and written to the host's plaintext session file — so printing the real
 * `tok_live_` key copied a long-lived, billing-capable credential out of the
 * 0600 credentials file into at least three places nobody would think to rotate.
 * The key is already persisted by the caller and every tokonomix_* tool reads it
 * from there, so the plaintext copy bought nothing.
 */
export function renderOnboardVerifySuccess(input: OnboardVerifySuccess): string {
  const overwriteNote = input.alreadyExisted
    ? '\n\n> Note: A previous credentials file existed and has been overwritten with your new key.'
    : '';

  return (
    `Account created successfully!\n\n` +
    `**Email:** ${input.email}\n` +
    `**API key:** \`${maskApiKey(input.rawKey)}\`\n` +
    `**Free credit:** €${input.creditsEur} (≈${input.approxCalls} consensus calls)\n\n` +
    `The key has been saved to \`${input.credentialsFile}\` (file mode 0600) — all tokonomix_* ` +
    `tools in this MCP server will use it automatically, so you do not need to copy it anywhere.\n\n` +
    `Only the masked form is shown above: a tool result is added to this conversation, sent to ` +
    `the model provider on the next turn, and written to your client's session log, so a key ` +
    `printed here would end up in all three. Read the full key from the credentials file if you ` +
    `need it, or mint and rotate keys in the dashboard.\n\n` +
    `**Set a dashboard password (optional):** use "Forgot password" — we email a reset link: ${input.setPasswordUrl}\n` +
    `**Dashboard:** ${input.dashboardUrl}` +
    overwriteNote
  );
}

// ─── Billing refusals, written for an AGENT (subscription system, Task 7) ────
//
// The reader of these strings is a coding agent in a loop, not a person looking
// at a dashboard. The thing that costs the human money is not a confusing
// sentence — it is a RETRY: an agent that reads "Tokonomix API 402" and cannot
// tell whether waiting or paying is the fix will do the only thing it knows how
// to do, which is try again, and it will keep doing it.
//
// So each rendering below states three things explicitly: what ran out, what the
// HUMAN can do about it (the agent cannot buy a plan on its own), and whether to
// retry. And the two cases stay firmly distinguishable, because their advice is
// opposite: a 402 says "buy something"; a closed window says "buying changes
// nothing, wait".


/** ISO → a short human date, or the raw value when it is not a date at all. */
function whenText(iso: string | undefined): string {
  if (!iso) return 'an unknown time';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

/**
 * An agent-actionable paragraph for a SUBSCRIPTION billing refusal, or null.
 *
 * ── WHAT IT REFUSES TO TOUCH (fix round 1) ─────────────────────────────────
 * It renders ONLY the two states the subscription system introduced, and it
 * decides that from the CONTEXT FIELDS IN THE BODY — never from the status
 * alone. An ordinary `402 insufficient_balance` from a payg account carries none
 * of those fields, gets null, and keeps its existing
 * `Tokonomix API 402: … (code=…, request_id=…)` message verbatim.
 *
 * The first version rewrote every 402. That was a behaviour change on a DORMANT
 * feature — a payg user's error text would have changed the day this package
 * shipped, with no flag involved and no subscription anywhere — and it dropped
 * the `request_id` and status that a support conversation actually needs.
 *
 * Both rendered cases now carry the request id, for the same reason.
 */
export function renderBillingError(err: unknown): string | null {
  if (!(err instanceof TokonomixApiError)) return null;
  const b = err.body ?? {};
  // Appended to a rendered paragraph so a person can quote it back to support.
  // The passthrough path needs no equivalent: the original message already ends
  // in `(code=…, request_id=…)`.
  const trailer = err.requestId ? ` (request_id=${err.requestId})` : '';

  // A closed spend WINDOW. Matched on the CODE, never the status: a plain
  // concurrency 429 means "slow down" and must not be renamed into a limit that
  // lasts until tomorrow. The code itself only exists in the subscription
  // system, so there is no pre-subscription behaviour to preserve here.
  if (err.code === 'rate_window_exhausted') {
    const window = b.window ?? 'usage';
    return (
      `Your Tokonomix usage window (${window}) is exhausted; capacity returns at ` +
      `${whenText(b.resets_at)}. Wait; a top-up does not lift this window.` +
      trailer
    );
  }

  // The subscriber 402: the plan allowance is spent AND the wallet is empty.
  // Requires BOTH context fields — a bare 402 is somebody else's error and is
  // handed straight back untouched. Both routes out are named because they are
  // genuinely different decisions: a top-up covers today, a bigger plan covers
  // the pattern.
  if (
    (err.status === 402 || err.code === 'insufficient_balance') &&
    b.allowance_remaining_cents === 0 &&
    b.plan_key
  ) {
    const topup = b.topup_url ?? 'https://tokonomix.ai/dashboard/billing';
    const upgrade = b.upgrade_url ?? 'https://tokonomix.ai/dashboard/billing';
    return (
      `Your Tokonomix plan allowance for this period is used up (resets ` +
      `${whenText(b.allowance_resets_at)}) and the wallet is empty. Tell the user they can top ` +
      `up at ${topup} or move to a bigger plan at ${upgrade}. Do not retry until then.` +
      trailer
    );
  }

  return null;
}

/** The `subscription` block from /api/v1/balance, as the gateway sends it. */
export interface SubscriptionBalanceBlock {
  plan_key: string;
  status: string;
  allowance_cents: number;
  allowance_remaining_cents: number;
  allowance_pct_used: number;
  period_end: string | null;
  resets_at: string | null;
  overage_source: string;
  windows: {
    daily: { cap_cents: number; remaining_cents: number; resets_at: string | null } | null;
    weekly: { cap_cents: number; remaining_cents: number; resets_at: string | null } | null;
  };
}

/**
 * The subscription lines of `tokonomix_get_balance`, or '' when the account has
 * no subscription (which is every account while the system is dormant, so the
 * tool's output is unchanged until the block actually arrives).
 *
 * An agent gating purely on `balance_cents` reads a subscriber's situation
 * backwards: their spend comes out of the plan allowance FIRST and only
 * overflows to the wallet, so an empty wallet does not mean "stop" and a full
 * one does not mean "all month is covered". The remaining allowance is the real
 * number, and a closed daily/weekly window is a stop that neither pot explains —
 * hence both are printed, and the window carries the note that a top-up does not
 * lift it.
 */
export function renderSubscriptionBalance(
  sub: SubscriptionBalanceBlock | null | undefined,
): string {
  if (!sub) return '';

  const eur = (cents: number): string => `€${(cents / 100).toFixed(2)}`;
  const lines = [
    '',
    '',
    `Plan: ${sub.plan_key} (${sub.status}) · allowance ${eur(sub.allowance_remaining_cents)} left of ` +
      `${eur(sub.allowance_cents)} (${sub.allowance_pct_used}% used)` +
      `${sub.resets_at ? ` · resets ${sub.resets_at}` : ''}`,
    `Overage: spend beyond the allowance is billed to the ${sub.overage_source}.`,
  ];

  for (const [name, w] of [
    ['Daily', sub.windows.daily],
    ['Weekly', sub.windows.weekly],
  ] as const) {
    if (!w) continue;
    lines.push(
      `${name} window: ${eur(w.remaining_cents)} left of ${eur(w.cap_cents)}` +
        `${w.resets_at ? ` · reopens ${w.resets_at}` : ''}` +
        `${w.remaining_cents <= 0 ? ' — CLOSED. Wait; a top-up does not lift this window.' : ''}`,
    );
  }

  return lines.join('\n');
}
