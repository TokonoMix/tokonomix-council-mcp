# Public changelog — tokonomix-gateway skill

User-facing changes only. No ticket numbers, no internal flags, no internal names.

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
