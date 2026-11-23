// Pure request-building helper for tokonomix_relay_human_feedback (the human
// channel, source_type='human_via_agent'). Kept separate from index.ts so the
// validation logic is unit-testable without spinning up the MCP server.

const MAX_FREE_TEXT_LENGTH = 2000;

/** Shape of the fields `TokonomixApiError` adds; kept structural so this module
 *  stays dependency-free and unit-testable without the http layer. */
type ApiErrorLike = { status?: unknown; code?: unknown; message?: unknown };

/** The gateway's error code for "the human-feedback relay is switched off". */
const RELAY_DISABLED_CODE = 'relay_disabled';

/**
 * Turn a failed relay call into the message the agent should show, or `null` when
 * this error is not a relay 404 and the caller must rethrow it.
 *
 * The bug this fixes (INT-2502): the relay endpoint returns ONE generic 404 for
 * several causes — deliberately, so it never reveals whether someone else's
 * request_id exists. The client used to translate every 404 into "not enabled on
 * this platform yet (DORMANT)". That is a conclusion the server never sent, and on
 * 2026-07-28 it told a real person their genuine feedback had been rejected by a
 * dormant platform while the flag was ON — the request had simply been billed to a
 * different account than the key the relay was called with.
 *
 * So: only `code: 'relay_disabled'` is reported as dormant. Every other 404 gets a
 * message that states what is actually known (not found under THIS key) and names
 * both remaining causes without claiming either — the client cannot tell them
 * apart, and pretending otherwise is what caused this ticket.
 */
export function describeRelayFailure(err: unknown): string | null {
  if (!(err instanceof Error)) return null;

  const e = err as Error & ApiErrorLike;
  const is404 =
    typeof e.status === 'number' ? e.status === 404 : e.message.includes('Tokonomix API 404');
  if (!is404) return null;

  // The gateway names this one explicitly, so we can state it as fact.
  if (e.code === RELAY_DISABLED_CODE) {
    return 'Human feedback relay is switched off on this platform (DORMANT). Nothing was recorded.';
  }

  // Older gateways predate the distinct code and answer every cause with
  // `not_found`. Say only what is true for all of them.
  return (
    'That consensus request was not found under the API key this session is connected with, ' +
    'so no feedback was recorded. Either the request_id is unknown to the platform, or the ' +
    'original consensus call was billed to a different account than the key in use here — ' +
    'relay the feedback with the same key that made the original call. ' +
    '(If this platform runs an older gateway, a switched-off relay also lands here.)'
  );
}

/**
 * Validate the raw tool arguments and build the POST body for
 * `/consensus/{request_id}/human-feedback`.
 *
 * Throws a plain Error with an agent-readable message on invalid input.
 */
export function buildHumanFeedbackBody(
  args: Record<string, unknown>,
): { request_id: string; body: Record<string, unknown> } {
  const requestId = typeof args.request_id === 'string' ? args.request_id.trim() : '';
  if (!requestId) throw new Error('request_id is required');

  const choice = typeof args.choice === 'number' ? args.choice : undefined;
  if (choice === undefined || !Number.isInteger(choice) || choice < 1 || choice > 5) {
    throw new Error('choice must be an integer between 1 and 5');
  }

  const body: Record<string, unknown> = { state: 'rated', choice };

  if (typeof args.free_text === 'string' && args.free_text.trim()) {
    body.free_text = args.free_text.trim().slice(0, MAX_FREE_TEXT_LENGTH);
  }

  return { request_id: requestId, body };
}
