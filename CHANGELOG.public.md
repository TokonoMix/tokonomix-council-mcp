# Changelog — tokonomix-council-mcp

Public changelog for the Tokonomix Council MCP server.

## 1.14.2

- **Examples no longer name Gemini 2.5.** Google shuts down `gemini-2.5-flash` and `gemini-2.5-pro` on
  1 December 2026. The tool descriptions, the README, the tutorial and the bundled skills (consensus skill
  1.11.1, gateway skill 1.0.2) now use `gemini-3.5-flash-lite` and `gemini-3.8-flash`, the successors Google
  names, and the Gemini image-editing example uses `gemini-3.1-flash-image`. No behaviour change.

## 1.14.1

- **The bundled skills are updated** (consensus skill 1.11.0, gateway skill 1.0.1). No code change in the server itself.
  - **Personal data: name an EU judge as well.** The consensus skill told you to set `hosting_region=eu`, but the
    consensus tools have no region field, and the judge (which reads the prompt and every answer) defaults to a
    model that is not EU-hosted. It now says to name EU `models` **and** an EU `judge_model`, picked from
    `tokonomix_list_models({"hosting_region": "eu"})`, or to use mode `raw`, which runs no judge.
  - **One route down is not the council down.** Before falling back to a single model, the skill now tries the
    same council by another route (remote MCP connector, this local server, or the HTTP API with
    `"model": "tokonomix-consensus"`), on the same account and key rules.
  - **Gateway examples fixed.** The council examples use `"model": "tokonomix-consensus"` (`"consensus"` was
    refused together with `x_council`); the EU example names EU models and an EU judge instead of a
    `hosting_region` field the gateway does not read; the curl example keeps your API key off the command line.

## 1.14.0

- **The `max_tokens` advice no longer steers you into empty answers.** The tool description told
  you to keep `max_tokens` low so slow models finish within ~60s. For reasoning models that is
  exactly wrong: they think out of the same budget, and at 1024–6000 tokens they often spend all
  of it thinking and return nothing. The description (and the bundled skill, now 1.10.0) now says
  to use 8192 or more with reasoning models, gives the real time limits (~120s per member, 180s
  per call including the judge), and names the warnings you will see when a limit is hit:
  `output_budget_exhausted`, `judge_not_run` and `substitution_skipped`.
- **Uploads declare their size up front.** `tokonomix_upload` now packs the files before
  asking for an upload URL and sends the byte length with the request, because the gateway now
  signs the URL for that exact size. A body larger than your key's cap is refused before anything
  is sent.
- **`tokonomix_list_models` can tell you a model will not answer before you spend a call on it.**
  Where the platform exposes it, a row now ends in `unroutable` when the model would not be
  dispatched right now, and the new `routable` filter drops those rows (`routable: true`) or shows
  only them (`routable: false`). It is a hint at list time, not a reservation — platform state
  moves on its own — and it does not account for your own provider keys: a BYOK call is never
  blocked by it. Against a gateway that does not expose routability the output is unchanged.

## 1.13.0

- **You now see when the model that answered is not the model you asked for.** The gateway has
  reported substitutions for a long time; this client never showed them, so asking for
  `claude-opus-5` and being served a different model looked exactly like getting what you
  asked for. Both `tokonomix_consensus_ask` and `tokonomix_single_ask` now name the model you
  requested, the model that answered, and why the first one did not.
- **`tokonomix_single_ask` tells you which mode ran.** It received the gateway's `mode` on every
  response and displayed none of it, so a single-model passthrough with a fallback list was
  indistinguishable from a council. It is now shown, as `tokonomix_consensus_ask` already did.
- **Gateway warnings reach you instead of being dropped.** The gateway puts a degradation notice
  in a top-level `warnings` field precisely so a client that does not read its council extension
  still sees it. This client did not read either. It does now — including the new notice that
  tells you a call ran as a passthrough rather than as a council, with no judge and no answers
  compared.
- **A model with more than one lane no longer reads as a single flat price.** When the gateway
  exposes per-lane pricing (a model served through more than one provider or region),
  `tokonomix_list_models` now shows the default lane's price prefixed with `from` and names the
  lane count — for example `from 100/600c per 1M · 2 lanes` — instead of one number that hid the
  others. Every model with a single lane (all of them today) renders exactly as before, and
  against a gateway that does not expose lanes the output is unchanged.

## 1.12.0

- **The relay no longer claims the platform is dormant when it isn't.** Submitting human
  feedback with `tokonomix_relay_human_feedback` used to answer *"Human feedback relay is not
  enabled on this platform yet (DORMANT)"* for every rejection, including the common case where
  the consensus call had simply been billed to a different account than the key in use. The
  client now only says "switched off" when the gateway actually says so, and otherwise tells you
  what is really the matter: the request was not found under this key, so relay it with the same
  key that made the original call. Against an older gateway that cannot tell the two apart, the
  client degrades to the truthful message rather than the old claim.

## 1.11.0

- **Per-unit prices for image and audio models.** Image-generation, image-edit and
  speech-to-text models are billed per image / per edit / per audio minute, not per token.
  `tokonomix_list_models` now shows that price (for example `0.45c/image` or `2c/audio-min`)
  where it previously showed the meaningless `null/nullc per 1M`. Models with only a one-sided
  token price (such as embeddings) render the missing side as `—`. Works against older gateways
  too — the new fields are optional.
- **Speed filters and a speed column in `tokonomix_list_models`.** New `speed_tier` and
  `max_p95_ms` arguments let an agent ask for "fast" models up front, and each row now carries
  the model's recently measured response speed (with a note on how it was measured) instead of
  leaving speed to guesswork.
- **Honest result counts.** The header above the model table now distinguishes "here are the
  first 100" from "there are 100 in total", using the server-side total when the gateway
  provides it — so an agent no longer picks a council from a list with an invisible tail.
- **Abstention is a first-class council verdict.** When the council declines to give a
  definitive answer, the verdict now renders as `abstained` together with the stated grounds,
  instead of being squeezed into pass/concerns.

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
