# Changelog — tokonomix-council-mcp

Public changelog for the Tokonomix Council MCP server.

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
