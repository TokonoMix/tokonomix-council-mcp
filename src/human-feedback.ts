// Pure request-building helper for tokonomix_relay_human_feedback (the human
// channel, source_type='human_via_agent'). Kept separate from index.ts so the
// validation logic is unit-testable without spinning up the MCP server.

const MAX_FREE_TEXT_LENGTH = 2000;

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
