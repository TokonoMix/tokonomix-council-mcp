# Changelog — tokonomix-gateway skill

Internal changelog. Includes ticket numbers, platform_settings flags, and
internal implementation details. For the user-facing changelog see CHANGELOG.public.md.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

---

## [1.0.0] — 2026-06

### Added
- **SKILL.md** — initial portable skill for direct HTTP users of the Tokonomix
  gateway. Covers all 15 live endpoints:
  - `/api/v1/chat/completions` (single + consensus, `x_council` block, all modes)
  - `/api/anthropic/v1/messages` (tool-calling + streaming simultaneously)
  - `/api/v1/images/generations` (text-to-image, OpenAI-compat + Gemini base64 path)
  - `/api/v1/images/edits` (multipart, OpenAI-family only)
  - `/api/v1/images/generations/health` (no-auth probe)
  - `/api/v1/image-capabilities` (no-auth catalog)
  - `/api/v1/embeddings`
  - `/api/v1/audio/transcriptions`
  - `/api/v1/rerank`
  - `/api/v1/models`
  - `/api/v1/providers`
  - `/api/v1/balance`
  - `/api/v1/generation?id=` (usage introspect)
  - `/api/v1/capabilities` (machine-readable guide)
  - `/api/v1/health` (no-auth health)
- Image consensus two-step pattern (generate → vision council review).
- Hermes / OpenAI-compatible agent setup section with LangChain + LlamaIndex examples.
- EU residency section with `hosting_region: "eu"` x_council field.
- Degradation ladder (402 → single_ask → host model → flag unverified).
- Cross-references to `tokonomix-council-mcp` and `agents-never-sleep`.
- **SETUP.md** — quick-start for developers (get key, install, first call in 60s).
- **CHANGELOG.md** (this file) and **CHANGELOG.public.md**.
- Bundled in `tokonomix-council-mcp` npm package under `skill/tokonomix-gateway/`
  (INT-architecture decision 2026-06-17).

### Context
- Gateway endpoints are live and have been since INT-1915 cluster (gateway-parity
  runs 2026-06-15/16). This skill is documentation, not new implementation.
- `platform_settings` flag `gateway_image_gen_enabled` controls image endpoint
  availability — skill says "probe health before calling" rather than referencing
  the internal flag.
- Bundling decision: bundle in MCP package now (`tokonomix-council-mcp@1.6.0`);
  `tokonomix` meta-package with `npx tokonomix setup` in a future phase.
