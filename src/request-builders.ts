// Outbound request-body builders for the /chat/completions gateway calls.
//
// Extracted from index.ts as pure functions so the *exact* wire shape can be
// unit-tested (review 4.6). The transparency property from SECURITY.md / README
// §3 — a consensus call sends ONLY `model`, `messages`, an optional `x_council`
// block, and an optional `max_tokens` — is now guarded by a test that asserts no
// unexpected top-level fields ever appear on the body. Keep these functions the
// single source of truth for the request shape; do not re-inline the assembly.

import { normalizeContext } from './http.js';

type Args = Record<string, unknown>;
type Message = { role: string; content: unknown };

/** system (optional) + user messages, in the order the gateway expects. */
export function buildMessages(a: Args, userContent: unknown): Message[] {
  const messages: Message[] = [];
  if (typeof a.system === 'string' && a.system) {
    messages.push({ role: 'system', content: a.system });
  }
  messages.push({ role: 'user', content: userContent });
  return messages;
}

/** Body for a consensus (council) call. The ONLY top-level keys it may set are
 *  `model`, `messages`, `x_council` (when non-empty), and `max_tokens` (when a
 *  number). Everything council-specific rides inside `x_council`. */
export function buildConsensusBody(a: Args, userContent: unknown): Record<string, unknown> {
  const messages = buildMessages(a, userContent);

  const xCouncil: Record<string, unknown> = {};
  if (typeof a.mode === 'string') xCouncil.mode = a.mode;
  if (Array.isArray(a.models) && a.models.length > 0) xCouncil.models = a.models;
  if (typeof a.judge_model === 'string' && a.judge_model) xCouncil.judge_model = a.judge_model;
  if (Array.isArray(a.judge_models) && a.judge_models.length > 0) xCouncil.judge_models = a.judge_models;
  const ctx = normalizeContext(a.context);
  if (ctx) xCouncil.context = ctx;
  // Grounding-gate continuation / override (only meaningful when the server
  // returned needs_context; harmless no-ops otherwise — server-gated).
  if (typeof a.request_id === 'string' && a.request_id) xCouncil.continuation_id = a.request_id;
  if (a.acknowledge_ungrounded === true) xCouncil.acknowledge_ungrounded = true;
  if (typeof a.acknowledge_reason === 'string' && a.acknowledge_reason)
    xCouncil.acknowledge_reason = a.acknowledge_reason;

  const body: Record<string, unknown> = {
    model: 'tokonomix-consensus',
    messages,
  };
  if (Object.keys(xCouncil).length > 0) body.x_council = xCouncil;
  if (typeof a.max_tokens === 'number') body.max_tokens = a.max_tokens;
  return body;
}

/** Body for a single-model passthrough call. Top-level keys: `model`,
 *  `messages`, and `max_tokens` (when a number). No `x_council`. */
export function buildSingleBody(a: Args, userContent: unknown, model: string): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model,
    messages: buildMessages(a, userContent),
  };
  if (typeof a.max_tokens === 'number') body.max_tokens = a.max_tokens;
  return body;
}
