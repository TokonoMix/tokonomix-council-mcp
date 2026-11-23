# Public changelog — tokonomix-gateway skill

User-facing changes only. No ticket numbers, no internal flags, no internal names.

---

## [1.0.2] — November 2026

- fix: the examples no longer name Gemini models that are being retired. The
  council examples use `gemini-3.5-flash-lite` instead of `gemini-2.5-flash`
  (shut down by Google on 1 December 2026), and the Gemini editing example uses
  `gemini-3.1-flash-image`.

## [1.0.1] — November 2026

- fix: the council examples now use `"model": "tokonomix-consensus"`. As
  written, `"consensus"` was refused when combined with `x_council`.
- fix: the EU data residency example now names EU models and an EU judge. The
  `hosting_region` field it showed inside `x_council` is not read by the
  gateway, so that example used the default, non-EU council.
- fix: the curl example no longer puts your API key on the command line; it
  reads it from `$TOKONOMIX_API_KEY` via stdin.

---

## [1.0.0] — June 2026

**Initial release.**

- improvement: Full skill for direct HTTP access to the Tokonomix gateway — chat,
  image generation, image editing, audio transcription, embeddings, reranking, and
  multi-model consensus, all from one `tok_live_...` key.
- improvement: OpenAI drop-in: set `OPENAI_BASE_URL=https://tokonomix.ai/api/v1`
  and your existing code routes through Tokonomix with no other changes.
- improvement: Anthropic drop-in: override `base_url` in the Anthropic SDK to
  access tool-calling + streaming simultaneously.
- improvement: Image consensus pattern — generate an image, then run a cross-vendor
  vision council review in one extra call.
- improvement: Hermes / LangChain / LlamaIndex setup examples — any
  OpenAI-compatible agent framework works with a single base_url swap.
- improvement: EU residency routing — add `"hosting_region": "eu"` to route
  personal-data prompts to OVHcloud France models.
- improvement: Budget degradation ladder — `402 → single model → host model →
  flag unverified` with error-to-ladder mapping.

---

## Related skills

- [tokonomix-council-mcp](../tokonomix-consensus/CHANGELOG.public.md) — MCP tools
  for Claude Code, Cursor, Cline, and other MCP hosts.
- [agents-never-sleep](https://github.com/TokonoMix/agents-never-sleep) — unattended
  backlog runner built on top of the gateway.
