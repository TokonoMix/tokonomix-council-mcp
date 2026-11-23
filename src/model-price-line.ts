/**
 * mcp-server/src/model-price-line.ts — the price cell for one model row in
 * `tokonomix_list_models`.
 *
 * Byte-for-byte mirror of lib/mcp/model-price-line.ts (the two MCP trees cannot
 * import each other — same duplication contract as list-models-summary.ts). Keep
 * them identical: a change here without the same change there is drift.
 *
 * multi-lane-catalog ticket 05 (2026-08-10): a model with more than one lane must
 * not read as a single flat price. When the gateway sends `lanes[]` and there is
 * more than one, prefix `from ` to the DEFAULT lane's price and name the count.
 * No lanes (flag off) or a single lane (every model today) → byte-identical.
 */

export interface ModelPriceCellInput {
  input_per_1m_cents: number | null;
  output_per_1m_cents: number | null;
  per_image_cents?: number | null;
  per_image_edit_cents?: number | null;
  per_audio_minute_cents?: number | null;
  /** Number of servable lanes, when the gateway exposed `lanes[]`. ≤1 → single price. */
  lane_count?: number | null;
}

export function formatModelPriceCell(m: ModelPriceCellInput): string {
  let base: string;
  if (m.input_per_1m_cents != null || m.output_per_1m_cents != null) {
    base = `${m.input_per_1m_cents ?? '—'}/${m.output_per_1m_cents ?? '—'}c per 1M`;
  } else if (m.per_image_cents != null || m.per_image_edit_cents != null) {
    const gen = m.per_image_cents != null ? `${m.per_image_cents}c/image` : '';
    const edit = m.per_image_edit_cents != null ? `${m.per_image_edit_cents}c/edit` : '';
    base = [gen, edit].filter(Boolean).join(' ');
  } else if (m.per_audio_minute_cents != null) {
    base = `${m.per_audio_minute_cents}c/audio-min`;
  } else {
    base = 'price unavailable';
  }
  if (typeof m.lane_count === 'number' && m.lane_count > 1 && base !== 'price unavailable') {
    return `from ${base} · ${m.lane_count} lanes`;
  }
  return base;
}
