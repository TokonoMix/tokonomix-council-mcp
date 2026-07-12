# Changelog — tokonomix-council-mcp

Public changelog for the Tokonomix Council MCP server.

## 1.10.0

- **Skill-source transparency.** Every response trailer now states where the skill guidance it
  followed came from, and a new `TOKONOMIX_SKILL_PIN=bundled` opt-in lets you pin the client to the
  skill text shipped inside this package instead of fetching the live copy from the gateway — for
  users who want a fully reproducible, review-once artefact with no runtime fetch.
- **Council participation reporting.** When the platform runs fewer models than requested (a member
  is unavailable or skipped), the client now reports which members actually participated, and warns
  when a requested judge count exceeds the platform cap — so you can see the real composition behind
  a verdict instead of assuming the full panel ran.
- **Honest documentation pass.** Corrected stale "coming soon / not enabled" copy for tools that are
  in fact live, added a tool-status table, labelled the benchmark evidence as *indicative* and noted
  the underlying harness/data are not yet published, documented the gateway trust boundary and data
  governance in `SECURITY.md`, and pointed every in-repo doc link at an absolute URL.
- **Supply-chain hardening (internal).** A fail-closed pack-allowlist guard now runs on every
  publish so no unintended file can ship in the tarball, request construction was extracted into a
  tested module, and a transparency-guard test asserts no undisclosed data leaves the client. No
  tool, protocol, or billing behaviour changed.

## 1.9.2

- **New tool: `tokonomix_relay_human_feedback`.** Relays a real HUMAN end-user's verdict on a
  consensus call (the human channel, `source_type='human_via_agent'`) — distinct from
  `tokonomix_rate_consensus`, which records the calling agent's own rating. Takes `request_id`,
  a 1-5 `choice` (1 = caught a blind spot · 2 = an important improvement · 3 = confirmed my
  approach · 4 = added nothing · 5 = was wrong/misleading), and an optional `free_text`. Until
  now agents had no MCP tool for this and would have needed a raw authenticated HTTP POST they
  usually can't make. Built DORMANT: returns a clear "not enabled" message until the platform
  enables human-feedback relay.

## 1.9.1

- **Fix: agent onboarding under the beta gate.** `tokonomix_onboard` now accepts an
  `accept_beta_terms` boolean and forwards it to the server. While Tokonomix is in beta the
  onboarding endpoint refuses to send the 6-digit code unless the user has accepted the beta
  terms; the previous tool had no way to pass acceptance, so `tokonomix_onboard` returned a
  400 and no email was ever sent. Confirm the beta terms with your human, then call
  `tokonomix_onboard(email, accept_beta_terms: true)`.

## 1.9.0

- **Internal module split.** `src/index.ts` was split into focused modules
  (`tools`, `http`, `render`, `full-mode`, `skill`, `image-validation`, `credentials`, `version`)
  for maintainability. No tool, protocol, or behaviour change — a pure internal refactor.
- **Base-URL guard (defence-in-depth).** The resolved `TOKONOMIX_BASE_URL` / site origin is now
  validated at startup: **https is required**, and a loopback/private/metadata host is rejected
  unless `TOKONOMIX_ALLOW_LOCAL=1` is set (local-dev opt-in). A non-default *public* https origin
  still works — it only prints a one-line warning, never blocks. The default
  `https://tokonomix.ai/api/v1` is unaffected.
  **⚠️ Breaking for a narrow case:** if you had configured an `http://` gateway, or a
  loopback/private gateway without the opt-in, the client now refuses to start until you switch to
  `https://` (or set `TOKONOMIX_ALLOW_LOCAL=1` for a local gateway).

## 1.8.7

- **Correct version telemetry.** The `User-Agent` header and the MCP `serverInfo` now report
  the real package version (read from `package.json`) instead of a hardcoded `0.1.0`. No
  behaviour change — fixes client-version reporting only.

## 1.8.6

- **Structured council verdict.** When the gateway emits a machine-readable judge verdict
  (`x_council.verdict` — `{overall, issues[]}`, present when the platform has the feature on),
  the MCP now surfaces it in the tool result so an orchestrating agent can read the judge's OWN
  assessment (severity + open/resolved issues) instead of only prose. Additive and backward-
  compatible: absent verdict → output unchanged.

## 1.8.4

- **MCP Registry listing.** Added the `mcpName: "ai.tokonomix/council"` field required by the
  official MCP Registry to link this npm package to its registry namespace, and published the
  server to `registry.modelcontextprotocol.io` (DNS-verified namespace). No tool or behaviour
  changes from 1.8.3.

## 1.8.3

- **Discoverability + metadata release** (no tool or behaviour changes). `package.json`: richer
  keywords (mcp-server, multi-model, llm-judge, openai/anthropic-compatible, claude, cursor, cline,
  gpt, gemini, vision, embeddings, eu-data-residency, gdpr, data-residency), corrected repository
  casing (`TokonoMix`), and `llms` / `llmsFull` / `mcpServer` AI-resource-discovery fields.
- Added `server.json` for the official **MCP Registry** (namespace `ai.tokonomix/council`,
  schema-validated against the live 2025-12-11 server schema).
- README reconciled with the positioning guardrails: EU is framed as **data-residency routing / a
  transatlantic-transfer hedge** (never "compliance" or "sovereign"), and the gateway is framed as
  **transport for consensus**, not a standalone product. Added a `claude mcp add` quick-install.
- Gateway skill description nudged with EU-routing + CI-pipeline keywords for trigger accuracy.

## 1.6.3

- **`tokonomix_rate_consensus` now takes an optional `consensus_benefit` verdict.** A
  privacy-safe categorical signal capturing whether the council actually helped — one of
  `caught_blind_spot`, `resolved_disagreement`, `raised_confidence`, `no_added_value`,
  `consensus_was_wrong`. It replaces the old free-text `note` (never stored) with a
  structured signal that feeds the model/blind-spot statistics. Supply it alongside
  `score` when you rate.
- **Skill guidance (v1.5.3):** agents are now asked to include the `consensus_benefit`
  verdict by default when rating a consensus.

## 1.6.2

- **Consensus feedback prompt now visible.** When a consensus answer is eligible for
  rating, the tool response now surfaces a clear "Feedback gevraagd" prompt (with the
  `request_id`) in both default and full mode. Previously this invitation was returned
  by the gateway but not shown, so agents never knew a rating was requested. Call
  `tokonomix_rate_consensus(request_id, score, …)` when you see the prompt.
- **Skill guidance (v1.5.2):** rating a consensus is now the default expected action
  (not optional) — a 1–10 usefulness rating feeds the model votes, statistics, and
  blind-spot reputation used to improve council selection. Human approval is still
  required before submitting detailed `findings`.

## 1.6.1

- Image generation / editing tool fixes and pricing alignment.

## 1.6.0

- Gateway HTTP surface parity; multi-provider single-model routing documentation.

## 1.5.x

- `tokonomix_rate_consensus` rating tool; skill auto-update via `_skill_version` trailer.
