/**
 * INT-2569 — the header line above the model table in `tokonomix_list_models`.
 *
 * It used to read `${r.data.length} models matched`, where `r.data` is the
 * ALREADY capped response. At the default limit that says "100 models matched",
 * which an agent reads as *there are 100* rather than *here are 100* — so it
 * picks a council out of a list with an invisible tail.
 *
 * Deliberate duplicate of `lib/mcp/list-models-summary.ts` in the main repo: this
 * package has its own tsconfig/publish boundary and cannot import across it. Keep
 * the two in step — same sentence from the remote and the stdio transport.
 */

/** Gateway defaults, mirrored from app/api/v1/models/route.ts. */
const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 1000;

export interface ListModelsSummaryInput {
  /** Number of models actually returned in `data`. */
  shown: number;
  /**
   * Total matching the SAME filters, counted server-side before the limit was
   * applied. Older gateways don't send it; then we cannot claim a total.
   */
  total?: number | null;
  /** The limit the gateway applied (echoed back). */
  limit?: number | null;
  /** Explicit truncation flag from the gateway, when present. */
  truncated?: boolean | null;
}

export function listModelsSummary(input: ListModelsSummaryInput): string {
  const { shown } = input;
  const total = typeof input.total === 'number' ? input.total : null;
  const limit = typeof input.limit === 'number' ? input.limit : null;

  if (total === null) {
    // No total from the gateway. Warn when the count sits on a cap we know
    // about — either the one the gateway echoed, or, when it echoed nothing, the
    // documented default/max. An older gateway sends neither field, so without
    // that second check a result capped at its own default would read as
    // complete, which is the exact bug this ticket exists to remove.
    const suspectedCap = limit ?? (shown >= MAX_LIMIT ? MAX_LIMIT : DEFAULT_LIMIT);
    if (shown >= suspectedCap) {
      return `${shown} models shown (limit=${suspectedCap}) — this may be capped; raise \`limit\` or narrow with \`supports\`/\`hosting_region\`.`;
    }
    return `${shown} models matched.`;
  }

  const truncated = input.truncated ?? total > shown;
  if (!truncated) {
    return `${total} models matched.`;
  }

  const limitNote = limit !== null ? ` (limit=${limit})` : '';
  return `showing ${shown} of ${total} models${limitNote} — raise \`limit\` or narrow with \`supports\`/\`hosting_region\`/\`tier\` to see the rest.`;
}
