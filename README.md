# tokonomix-council-mcp

[![npm version](https://img.shields.io/npm/v/tokonomix-council-mcp.svg)](https://www.npmjs.com/package/tokonomix-council-mcp)
[![license](https://img.shields.io/npm/l/tokonomix-council-mcp.svg)](./LICENSE)
[![node](https://img.shields.io/node/v/tokonomix-council-mcp.svg)](https://nodejs.org)
[![MCP Registry](https://img.shields.io/badge/MCP%20Registry-.well--known%2Fmcp-blue)](https://tokonomix.ai/.well-known/mcp/server.json)

**Stop trusting one model. Ask a panel.**

`tokonomix-council-mcp` gives any MCP-compatible AI tool a single, decisive verification step: send a hard question to **2–6 frontier LLMs at once**, have an **independent judge weigh their answers — a model should never grade its own homework** — and get back **one answer you can act on**, plus the disagreements a single model would have hidden from you.

Works with **Claude Code, Cursor, Cline, Continue, and Zed**. One `npx` line to install.

**Use it where being wrong is expensive** — security reviews, architecture decisions, compliance/legal questions, database migrations. **Skip it for** variable renames, formatting, and simple CRUD: a single model is cheaper and fine there.

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

## Why a single vendor can't sell you this

The value is the *cross-vendor* check — and that is exactly the one thing no single model provider can give you:

- **OpenAI can't grade Claude. Anthropic can't grade Gemini. Google can't grade GPT.** A vendor's own "panel" is its own models sharing its own training data and its own blind spots — correlated errors dressed up as agreement.
- **A model should never grade its own homework.** By default the judge is a *different* model from a *different* vendor than the proposers it scores (and is never asked to score its own answer), so the synthesis step doesn't inherit the blind spot it's supposed to catch. You can override the judge, so pick a cross-family one.

Ask one vendor for a second opinion and you get the same opinion twice. The decorrelation only exists *across* vendors — and routing across vendors through a neutral judge is the thing Tokonomix does that a single-vendor API structurally cannot.

| One model | A cross-vendor council |
|---|---|
| One opinion, one blind spot | 2–6 opinions across vendors |
| Confidently wrong, silently | Disagreement surfaced explicitly (`diff`) |
| Grades its own homework | Independent cross-vendor judge |
| You don't learn what it missed | The lone dissent is preserved, not averaged away |

### Does it actually catch more? (measured — published as-is, including where it cuts against us)

We ran a small security-review benchmark: 12 self-authored snippets, one seeded vulnerability each, plus 4 clean controls, scored blind by a non-council model.

| Reviewer | Caught (of 12) | False-positive flags (on 4 clean snippets) | Model calls |
|---|---|---|---|
| Single — GPT-4o | 7 | 1 | 1 |
| Single — Gemini 2.5 Flash | 11 | 5 | 1 |
| Single — Claude Haiku 4.5 | 12 | 5 | 1 |
| Council (consensus) | 12 | 7 | ~4 |
| Council (diff) | 12 | 8 | ~4 |

**Read it straight: on this set the council did *not* beat the best single model.** The cheapest single model we tested (Claude Haiku 4.5) already caught all 12 — with *fewer* false-positive flags and *one* model call instead of ~four. The council matched that recall; it did not exceed it, and it costs more and flags more.

So why reach for it? **Which single model is strong shifts per bug.** On the *same* tasks, GPT-4o caught 7/12 (it returned "no issues" on a timing side-channel, an IDOR, a missing-auth check, a predictable reset token and a race), Gemini 11/12, Haiku 12/12. Standardise on the wrong single model and you ship real bugs. The council buys **top-of-panel recall without having to know in advance which model that is** — and `diff` mode surfaces the lone dissenter instead of averaging it away. The price is precision and cost: more flags to triage, ~4× the calls.

**⚠️ Small, self-authored benchmark — do not over-read it.** Twelve snippets means "5 of 12 missed," not a percentage. Classic vulnerability classes are close to a best case for LLM detection — on subtle real-world bugs every arm scores lower and the *direction* of the gap is unknown. The grader is a single blind LLM whose own error rate we have not measured. False-positive counts are raw flags (flag-level), not directly comparable to the snippet-level recall column. Harness, dataset and raw transcripts are kept for reproduction. We publish only what we measured — including when the numbers don't flatter us.

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

> *"Use tokonomix in `diff` mode to check whether this migration is reversible — surface any model that flags it irreversible."* (For a safety check you want the lone dissenter preserved, not averaged away — that's `diff`, not `consensus`.)

Your assistant calls `tokonomix_consensus_ask` and comes back with a verified answer instead of a guess.

## Tools

| Tool | What it does |
|---|---|
| `tokonomix_consensus_ask` | The core: 2–6 proposers + judge panel → one answer (modes below) |
| `tokonomix_single_ask` | Single-model passthrough — cheap, for routine calls |
| `tokonomix_list_models` | Live catalog, filterable by region, provider, tier, capability |
| `tokonomix_get_balance` | Credit balance, tier, and month-to-date usage — € spent **and** token throughput, by mode |
| `tokonomix_rate_consensus` | Rate a consensus result by `request_id` — feeds the low-weight human-preference signal (never a correctness signal) |
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

**Council auto-selection** — when `images` is present and no `models` are specified, `tokonomix_consensus_ask` routes to a default vision panel (a current Claude, Gemini and GPT vision model — query `tokonomix_list_models({"supports":["vision"]})` for the live slugs, which drift). With an explicit model list, non-vision models are skipped (reported in `x_council.skipped`). A non-vision single model in `tokonomix_single_ask` returns 400 from the gateway.

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
| **Single-model** | `POST /api/anthropic/v1/messages` | Anthropic Messages wire-format · **routes to any provider model** (OpenAI, Google, Anthropic, OVH-EU, Azure, xAI, Ollama…) | **forwarded** — `tools`/`tool_choice` + server-tools (web search) round-trip as `tool_use`; `cache_control` prompt-caching is billed at proper cache-tier rates |

So: use the **council path** (or `tokonomix_consensus_ask`) when you want a verified, synthesized answer;
use the **single-model path** when an agent needs native function-calling, schema-constrained output, or
prompt caching. That path speaks the Anthropic Messages wire-format, but it is **not Anthropic-only** —
the gateway routes the call to whichever configured provider hosts the model you name (OpenAI, Google,
Anthropic, Azure, OVH-EU, xAI, Ollama, …).

> **Agentic tool-use (e.g. running [open-code-review](https://github.com/alibaba/open-code-review) through
> Tokonomix):** point the client at `https://tokonomix.ai/api/anthropic` with the Anthropic wire format,
> and **unset any ambient `ANTHROPIC_API_KEY`** in the environment — some SDKs send it as `x-api-key`
> alongside your `tok_live_` bearer, which the gateway rejects.

## Configuration

| Env var | Default | Description |
|---|---|---|
| `TOKONOMIX_API_KEY` | — *(required)* | Bearer key, starts with `tok_live_` |
| `TOKONOMIX_BASE_URL` | `https://tokonomix.ai/api/v1` | OpenAI-compatible base (council). Anthropic base: `https://tokonomix.ai/api/anthropic` |

### Per-key guardrails

Budget and routing are set **on the key**, not re-decided per call. Each API key carries its own preferences:

- a **predefined default model + council route** — which proposers, which judge, which mode;
- a gateway-enforced **monthly spend cap** (`monthly_limit_cents`) — the key is blocked once the month's charged spend would exceed it;
- **allow-lists** by model / mode / judge / hosting region / model-origin country.

So you can hand a key to an unattended run and trust that it can't overspend or route somewhere you didn't intend. Track usage against the cap with `tokonomix_get_balance` (€ **and** tokens, month-to-date).

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

[github.com/tokonomix/tokonomix-council-mcp/issues](https://github.com/tokonomix/tokonomix-council-mcp/issues) · `support@tokonomix.ai`
