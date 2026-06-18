# Public changelog — tokonomix-council-mcp

User-facing changes only. No ticket numbers, no internal flags, no internal names.

---

## [1.5.2] — June 2026

- fix: `review_reward` (reviewer credit amount) now correctly surfaced in
  `tokonomix_rate_consensus` responses — it was present in the gateway response
  but not returned by the MCP tool.

## [1.5.1] — June 2026

- docs: security-review benchmark framing corrected — numbers now reflect what
  the data actually shows, including per-model variance, false-positive rates,
  small-N caveats, and cost column; no cherry-picked percentages.
- docs: judge independence described accurately as the default (self-scoring
  exclusion + disjoint pool) rather than a hard server guarantee; diff-mode
  example added for migration safety checks.

## [1.5.0] — June 2026

- improvement: `tokonomix_get_balance` now reports month-to-date **token
  throughput** alongside € spend, so token-budgeted runs can gate on throughput
  not only cost.
- docs: per-key guardrails explained — a key carries its own default council,
  monthly spend cap, and optional model/mode/region restrictions; set once on
  the key, trusted across every run.

## [1.4.0] — June 2026

- improvement: **Prompt caching passes through** — Anthropic `cache_control`
  breakpoints forwarded to the provider; a stable system prompt or large context
  is billed at cache-read rates on repeat calls, same as hitting Anthropic
  directly. OpenAI auto-caching likewise honoured.
- improvement: **Shared context-pack** — when a council is grounded on a
  context-pack, the same pack is reused by every proposer and the judge; you
  pay for the context once, not once per model.
- fix: removed the steer to bypass Tokonomix for caching — caching works
  through the gateway, no bypass needed.

## [1.3.0] — June 2026

- improvement: **Vision / image input** — `tokonomix_consensus_ask` and
  `tokonomix_single_ask` now accept an `images` array (`{data, media_type}`).
  Pass up to 8 images (≤5 MB each, ≤20 MB total). Non-vision models in an
  explicit list are skipped. Omitting `models` auto-selects a cross-vendor vision
  panel.
- improvement: Client-side validation before the network call — data-URI prefix
  detection, size limits, media-type whitelist, with clear error messages.

## [1.2.0] — June 2026

- improvement: New "How the council is built" section explaining why this is
  more than voting: parallel blind proposers (no debate capitulation), disjoint
  independent judge, decorrelation-over-raw-score selection, empirical guarded
  model selection.
- improvement: Consensus reframed as a **recall amplifier that feeds human
  judgment**, not a truth oracle. Agreement raises confidence, not correctness.
- improvement: Grounding called out as the single biggest lever against shared
  hallucination — feed the real diff/spec/logs.
- improvement: `diff` mode elevated as the discovery mode — preserves the lone
  dissenter instead of averaging it away; recommended for security and migration
  review.

## [1.1.1] — June 2026

- improvement: Honest epistemics — consensus framed as "reduces single-model
  error and surfaces disagreement", not a correctness guarantee.
- improvement: Budget degradation ladder — `consensus → single_ask → host model
  → flag unverified` with error-to-rung mapping (`402`, `429`, `5xx`).
- improvement: Reproducibility guidance — record proposer models, judge, and
  `charged_credits` for decisions of record.
- improvement: Skill self-update surfaces a version/date/changelog notice when
  the server version changes.
- fix: `bytes` field reports correct UTF-8 byte length.

## [1.0.0] — June 2026

- improvement: Initial release — multi-model consensus with judge synthesis,
  single-model passthrough, EU residency routing, balance check, keyless
  onboarding, and self-update.

---

## Related skills

- [tokonomix-gateway](../tokonomix-gateway/CHANGELOG.public.md) — direct HTTP
  access for apps and agent frameworks not using MCP.
- [agents-never-sleep](https://github.com/TokonoMix/agents-never-sleep) —
  unattended backlog runner.
