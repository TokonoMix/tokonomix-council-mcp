# tokonomix-council-mcp

[![npm version](https://img.shields.io/npm/v/tokonomix-council-mcp.svg)](https://www.npmjs.com/package/tokonomix-council-mcp)
[![license](https://img.shields.io/npm/l/tokonomix-council-mcp.svg)](./LICENSE)
[![node](https://img.shields.io/node/v/tokonomix-council-mcp.svg)](https://nodejs.org)

**Stop trusting one model. Ask a panel.**

`tokonomix-council-mcp` gives any MCP-compatible AI tool a single, decisive verification step: send a hard question to **2–6 frontier LLMs at once**, have an **independent judge panel** weigh their answers, and get back **one answer you can act on** — plus the disagreements a single model would have hidden from you.

Works with **Claude Code, Cursor, Cline, Continue, and Zed**. One `npx` line to install.

---

## Why

A single LLM is a single point of failure. It hallucinates with total confidence, and — worse — it never tells you what it *didn't* consider. For a chat reply that's fine. For a legal clause, a security review, a GDPR decision, or a migration plan, a confidently-wrong answer is expensive.

The fix isn't a bigger model. It's a **second opinion, automated** — and a third, and a judge who has no stake in any of them.

```
            ┌─ Claude  ─┐
your prompt ─┼─ GPT     ─┼──▶  judge panel  ──▶  one verified answer
            ├─ Gemini  ─┤      (scores, ranks,    + the disagreements
            └─ …(2–6)  ─┘       reconciles)          that surfaced
```

## How it works

1. **Fan-out, parallel & blind.** Your prompt goes to 2–6 frontier models *in parallel* — across vendors (Anthropic, OpenAI, Google, and EU-hosted options). Each answers independently and sees none of the others, so there is no round-table where the lone dissenter caves to the majority. The value comes from *uncorrelated* errors, so selection favours **diversity + competence, not raw score** (picking only the top models converges on similar ones and shrinks the decorrelation).
2. **Independent judge.** One or more **judge models — disjoint from the proposers, and never scoring their own proposal** — read the candidate answers blind and reconcile them: which claims are corroborated, which are outliers, which are simply wrong. A cross-family judge avoids inheriting one vendor's blind spot.
3. **Multi-judge panel (optional).** Pass several judges and the strongest synthesis wins. More judges reduce one judge's idiosyncrasy (e.g. the known bias toward long, confident answers) — but, like the proposers, judges share training data, so this lifts *reliability*, not the ceiling. Grounding does more than adding judges.
4. **One answer back.** You get a synthesized result — or, if you ask for it (`diff`), the full agreement/disagreement breakdown with the dissent preserved.

The orchestration, scoring and reconciliation run server-side; you call one tool and get one result.

## What it does — and doesn't — give you

Consensus **reduces single-model error and surfaces disagreement** one model would hide. It does **not** guarantee correctness. Frontier models share heavily overlapping training data, so on a shared blind spot (post-cutoff facts, niche domains) they can agree *and be uniformly wrong* — consensus measures *agreement*, not truth.

Read it as a **recall amplifier that feeds your judgment, not a truth oracle or a blind merge gate**: with several different vendors you only need one to catch the timing side-channel, and it gets surfaced (high recall) — at the cost of more flags to adjudicate (lower precision). That trade is worth it for rare, high-asymmetric-cost decisions (auth, migrations, GDPR, money) and *not* for routine work. **The biggest lever against shared hallucination is grounding** — feed verifiable ground truth (real logs, the actual file/spec) — not more models. For empirical model selection, human votes count only as a low-weight *preference* signal (they share the judge's length/confidence bias), never as a correctness signal.

## Disagreement & blind-spot detection

Consensus is only half the value. The other half is seeing **what only some models caught** — the blind spots.

Run `mode: "diff"` and instead of a smoothed-over answer you get a structured report of **where the panel agreed and where it split**. That split is the signal:

> **Example — a code review.** You ask 5 models "is this auth middleware safe?" Four say "looks fine." One flags that the token comparison isn't constant-time (a timing side-channel). A single-model call would have returned "looks fine" and you'd have shipped it. `diff` surfaces the lone dissent so a human can adjudicate the thing that actually matters.

> **Example — a compliance question.** Four models say a data flow is GDPR-fine; one notes it lacks a documented sub-processor. The disagreement *is* the finding.

Blind spots hide in the gaps between models. `diff` mode is built to drag them into the open.

## Quick start

### 1. Get an API key

Sign up at **[tokonomix.ai/dashboard/signup](https://tokonomix.ai/dashboard/signup)** — **€5.00 free credit** on signup, no card required. Issue a key at `/dashboard/keys` (it starts with `tok_live_`).

### 2. Add it to your client

**Claude Code** — `.mcp.json` in your project, or `~/.claude.json`:

```json
{
  "mcpServers": {
    "tokonomix": {
      "command": "npx",
      "args": ["-y", "tokonomix-council-mcp"],
      "env": { "TOKONOMIX_API_KEY": "tok_live_..." }
    }
  }
}
```

**Cursor / Cline / Continue / Zed** — the same `command` + `args` + `env` triple goes in your tool's MCP-server config.

### 3. Use it

> *"Use tokonomix to get a 4-model consensus on whether this migration is reversible."*

Your assistant calls `tokonomix_consensus_ask` and comes back with a verified answer instead of a guess.

## Tools

| Tool | What it does |
|---|---|
| `tokonomix_consensus_ask` | The core: 2–6 proposers + judge panel → one answer (modes below) |
| `tokonomix_single_ask` | Single-model passthrough — cheap, for routine calls |
| `tokonomix_list_models` | Live catalog, filterable by region, provider, tier, capability |
| `tokonomix_get_balance` | Credit balance + account tier |
| `tokonomix_onboard` | Keyless first run, step 1 — email a one-time code |
| `tokonomix_onboard_verify` | Keyless first run, step 2 — provision a free account + save the key |
| `tokonomix_get_skill` | Fetch the canonical usage skill from the server |
| `tokonomix_skill_version` | Cheap version fingerprint of the skill (detect drift) |

**No key yet?** Run `tokonomix_onboard("you@example.com")`, then `tokonomix_onboard_verify` with the emailed code — it provisions a free-tier account (€5 credit) and saves the key to `~/.tokonomix/credentials.json`. No env var needed.

## Modes

| Mode | What you get | Use it for |
|---|---|---|
| `consensus` *(default)* | One synthesized answer built from the most-corroborated claims | "Just give me the right answer" |
| `diff` | Structured **agreements + disagreements** report | Fact-checking, reviews, surfacing blind spots |
| `best_of` | The judge picks one proposer's answer verbatim | When you want a real model's voice, vetted |
| `full` | Proposers **and** judge reasoning **and** the final conclusion, together | Auditability — show your work |
| `raw` | Every proposer's raw answer, no synthesis | Custom downstream reduction |

## Vision / image input

Both `tokonomix_consensus_ask` and `tokonomix_single_ask` accept an optional `images` array. Images are included in the user message as OpenAI-style content parts.

**Parameter shape** — each image object has two required fields:

| Field | Type | Notes |
|---|---|---|
| `data` | string | Raw base64 — **no** `data:image/...;base64,` prefix. A `data:`-prefixed value is rejected with a clear error. |
| `media_type` | string | `image/jpeg`, `image/png`, `image/webp`, or `image/gif`. |

**Constraints** (validated client-side before the network call, fast error on violation):

| Constraint | Limit |
|---|---|
| Images per message | ≤ 8 |
| Decoded size per image | < 5 MB |
| Total decoded size | ≤ 20 MB |
| Format | Inline base64 only — no external URLs |
| Streaming | Non-streaming only (MCP server never streams) |

**Vision models** — discover via `tokonomix_list_models({"supports": ["vision"]})`.

**Council auto-selection** — when `images` is present and no `models` are specified, `tokonomix_consensus_ask` routes to a default vision panel (claude-fable-5 + gemini-2.5-pro + gpt-4o class). With an explicit model list, non-vision models are skipped (reported in `x_council.skipped`). A non-vision single model in `tokonomix_single_ask` returns 400 from the gateway.

```js
// Multi-model vision: compare two architecture diagrams
tokonomix_consensus_ask({
  prompt: "What are the key differences between these two diagrams? Focus on data-flow and security boundaries.",
  mode: "diff",
  images: [
    { data: "/9j/4AAQSkZJRgAB...", media_type: "image/jpeg" },
    { data: "iVBORw0KGgoAAAAN...", media_type: "image/png" }
  ]
})

// Single-model vision: extract text from a screenshot
tokonomix_single_ask({
  prompt: "Extract all visible text from this screenshot.",
  model: "gpt-4o",
  images: [{ data: "iVBORw0KGgoAAAAN...", media_type: "image/png" }]
})
```

## Model catalog & sovereignty routing

Discover what's reachable and route by where data is processed:

```js
// All EU-hosted models that support tool-use
tokonomix_list_models({ "hosting_region": "eu", "supports": ["tools"] })
```

Filters: `hosting_region` (`eu` matches EU/FR, `us`, `multi`), `provider`, `tier`, `supports` (`tools`, `vision`, `json_schema`, `reasoning`, `prompt_caching`, `pdf_input`, `audio_input`). Pin an EU-only panel for GDPR-strict work, or mix vendors deliberately for maximum cross-family coverage.

## Direct API & per-path capabilities

Beyond the MCP tools, the gateway exposes two HTTP surfaces with **different capability profiles** —
worth knowing when an agent needs native tool-calling or structured output:

| Surface | Endpoint | Shape | tool-calling · structured-output · web-search · prompt-caching |
|---|---|---|---|
| **Council** (multi-model) | `POST /api/v1/chat/completions` | OpenAI-compatible | **not forwarded** — consensus fans out to N proposers + a judge; tool-calls/structured-output can't be averaged, so they are single-model-only |
| **Single-model** | `POST /api/anthropic/v1/messages` | Anthropic-compatible | **forwarded** — `tools`/`tool_choice` + server-tools (web search) round-trip as `tool_use`; `cache_control` prompt-caching is billed at proper cache-tier rates |

So: use the **council path** (or `tokonomix_consensus_ask`) when you want a verified, synthesized answer;
use the **Anthropic single-model path** when an agent needs native function-calling, schema-constrained
output, or prompt caching.

> **Agentic tool-use (e.g. running [open-code-review](https://github.com/alibaba/open-code-review) through
> Tokonomix):** point the client at `https://tokonomix.ai/api/anthropic` with the Anthropic wire format,
> and **unset any ambient `ANTHROPIC_API_KEY`** in the environment — some SDKs send it as `x-api-key`
> alongside your `tok_live_` bearer, which the gateway rejects.

## Configuration

| Env var | Default | Description |
|---|---|---|
| `TOKONOMIX_API_KEY` | — *(required)* | Bearer key, starts with `tok_live_` |
| `TOKONOMIX_BASE_URL` | `https://tokonomix.ai/api/v1` | OpenAI-compatible base (council). Anthropic base: `https://tokonomix.ai/api/anthropic` |

## Pricing

**€5.00 free credit** to start, no card. After that it's pay-as-you-go on top of provider cost, with Pro and bring-your-own-key options. Current packages: **[tokonomix.ai/pricing](https://tokonomix.ai/pricing)**.

## The skill

The package ships a `tokonomix-consensus` skill (`skill/tokonomix-consensus/SKILL.md`) that teaches your agent *when* to reach for consensus instead of a single call. Drop it into `.claude/skills/`, or let the agent pull it at runtime via `tokonomix_get_skill`.

## Development

```bash
cd mcp-server
npm install
npm run dev          # run from source (tsx)
npm run build && npm start
```

The server speaks the MCP stdio transport.

## License

MIT © [Tokonomix.ai](https://tokonomix.ai) / InterIP Networks

## Issues & feedback

[github.com/InterIP/tokonomix/issues](https://github.com/InterIP/tokonomix/issues) · `support@tokonomix.ai`
