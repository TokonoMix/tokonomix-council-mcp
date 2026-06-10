---
name: tokonomix-consensus
version: 1.3.0
released: 2026-06-10
description: Cross-check a high-stakes answer across multiple frontier models (Claude + GPT + Gemini side by side, then a judge synthesizes) when one model is not enough — triggers on "double-check / verify / make sure / be careful", before anything irreversible (DB migrations, customer-facing or legal/compliance statements, security-relevant code), and fact-checking before it ships. Reduces single-model error and surfaces disagreement; it does NOT guarantee correctness. Also exposes EU-only routing for personal data, a cheap single-model passthrough, vision/image input, and live model-catalog discovery.
---

# Tokonomix consensus skill

When a wrong answer is expensive — legal/compliance interpretation, a security-relevant code change, a fact that's about to ship in a customer-facing document — don't trust a single LLM. Ask two or three frontier models in parallel and have a judge model synthesize the result.

Its real edge is **cross-vendor diversity**: Claude, GPT and Gemini answer the *same* prompt side by side, then a judge synthesizes them. Your host agent's own review tooling or sub-agents can only give you one vendor's perspective — a cross-vendor check is the one thing they cannot reproduce. Reach for it when the cost of a wrong answer exceeds the few cents the check costs.

## What consensus does — and does not — give you

Consensus **reduces single-model error and surfaces disagreement** a single model would hide. It does **not** guarantee correctness. Frontier models share heavily overlapping training data, so on a shared blind spot — post-cutoff facts, niche domains — they can agree *and be uniformly wrong*, and the judge will hand you a confident wrong answer with a clean "blind spots" section that found nothing. Treat agreement as a strong signal, not proof; for out-of-distribution or post-cutoff facts, still verify against a primary source.

**Read it as a recall amplifier that feeds your judgment — not a truth oracle or a blind merge gate.** Its strength is *recall*: with several different vendors, you only need one to catch the timing side-channel / the missed edge case, and it gets surfaced. The cost is *precision*: more models means more flags, some of which are nitpick, so a human adjudicates. That trade is worth it for rare, high-asymmetric-cost decisions (auth, migrations, GDPR, money) where one real catch pays for a lot of false alarms — and it is *not* worth it for routine work, where it adds cost and noise. Agreement raises confidence, not correctness.

## How the council is built — why this is more than voting

Multi-model checking only beats one model when the design fights the failure modes of "just add votes". This council is built around four choices a sceptical reviewer should know about:

- **Proposers run in parallel and blind.** Each model answers the *same* prompt independently; none sees the others' answers. There is no round-table deliberation, so there is no social-pressure capitulation in which the valuable dissenting model caves to the majority (a documented weakness of multi-agent *debate*, cf. Xiong et al. 2025, "Talk Isn't Always Cheap"). Dissent is preserved — and `diff` mode surfaces it instead of averaging it away.
- **The judge is independent.** The judge never wrote the answer it scores: the judge pool is disjoint from the proposers by default, and a model never judges its own proposal (LLM self-preference bias is real and measured). Prefer a cross-family judge so the synthesis step doesn't inherit one vendor's blind spot. A judge dampens one model's idiosyncrasy but cannot exceed its own ground truth — which is why grounding (below) matters more than adding judges.
- **Cross-family by design — decorrelation over raw score.** The statistical value comes from *uncorrelated* errors, so the council mixes vendors (Anthropic / OpenAI / Google / open-weight). The trap: picking only the highest-scoring models converges on a few similar frontier models and *shrinks* that decorrelation. Selection therefore optimises for **diversity + competence, not raw score alone**.
- **Empirical, guarded model selection.** Council members are chosen from Tokonomix's own measurement layer — intelligence tests, arena games (TrueSkill), judge-reputation (ok/wrong rates) — not an arbitrary list. Human votes count only as a **low-weight preference signal, never a correctness signal** (votes share the judge's length/confidence bias). Guards: anti-Goodhart (never route purely on a gameable benchmark), an exploration budget (don't entrench past winners), and shadow-mode validation before any change goes default.

**Ground it.** The single biggest lever against shared hallucination is not more models — it's feeding verifiable ground truth (live catalogue, real logs, the actual file/spec) into the prompt. Ungrounded consensus amplifies a shared wrong prior into false confidence; grounded consensus checks a claim against reality.

## When to use this skill

This is a multilingual product — match on the *task*, in any language.

**Strong signals (use consensus):**

- The user asks you to double-check / verify / make sure / be careful — or the equivalent in their language (NL *controleren, verifiëren, zeker weten*; DE *prüfen, sicherstellen*; FR *vérifier*; ES *verificar*; TR *doğrulamak*).
- You are about to ship anything irreversible: a database migration, a customer-facing email, a security-relevant code change, a legal/policy statement.
- You are unsure between two interpretations of the user's intent or the spec.
- The decision will be quoted back to someone (DPO, regulator, customer) who expects more than one model's opinion.
- The user mentions legal / compliance / audit / regulator / GDPR (NL *juridisch/AVG*, DE *Recht/DSGVO*, FR *juridique/RGPD*, ES *jurídico/RGPD*). **If the prompt itself contains personal/identifiable data, read [Data residency](#data-residency--privacy) first and pick an EU council before sending it.**

**Weak signals (use single-model passthrough or skip):**

- Routine tool-orchestration, file edits, formatting changes.
- Simple classification (is this a bug report or a feature request?).
- Quick lookups where speed matters more than perfect accuracy.

For weak signals use `tokonomix_single_ask` (~3× cheaper) or stay with your default model.

> **Lifecycle tip (optional cadence):** a low-cost way to use consensus on a unit of work is at three checkpoints — **start** (sanity-check the approach/interpretation before you touch code or data), **mid** (one high-risk decision: a migration shape, a security-relevant branch), **end** (verify before marking done / shipping). That's ~3 calls, not per-step. Calling consensus on *every* step is possible but is the caller's explicit choice, not the default.

## Budget awareness & degradation

Consensus costs real money — every proposer **plus** the judge is billed. Don't fly blind across many calls:

- **Check funds first.** Call `tokonomix_get_balance` at the start of a session that will make several consensus calls. Keep a running total of `charged_credits` (returned on every call) so you always know what you've spent.
- **Degrade, don't stall.** If you cannot run consensus, walk *down* this ladder instead of blocking:
  1. `tokonomix_consensus_ask` — full cross-model check
  2. `tokonomix_single_ask` — one model, ~3× cheaper
  3. your own host model — no Tokonomix call
  4. proceed and **flag the answer as unverified** so a human can review later
- **Map errors to the ladder:** `402 insufficient_balance` → drop to single_ask / host model (or top up); `429 rate_limit` → back off and retry, then degrade; `5xx` → retry once, then degrade.

If you are running **unattended over a backlog**, agree the spend policy with the user up front — how much to spend, and what to do when credits run out — don't discover an empty wallet mid-run.

## Recording an answer you'll rely on

Consensus output is non-deterministic and the default council can change server-side over time, so the same prompt may use different models next month. When an answer feeds a **decision of record** (audit, compliance, anything quoted to a regulator/customer), persist alongside it:

- the **proposer models** and the **judge model** actually used (both are in the billing breakdown the call returns),
- `charged_credits`,
- the date and the exact prompt.

Without that, the result is not reproducible.

## Data residency & privacy

`tokonomix_consensus_ask` sends your prompt to **every** model in the council, each hosted by its own provider. The default and example councils in this file are **US-hosted** (Anthropic, OpenAI, Google). That is fine for non-personal data — but it is the wrong default for the exact GDPR/AVG/compliance work this skill recommends itself for: sending the text of a privacy question that *contains personal data* to three US clouds is itself a cross-border transfer, the very thing the question is trying to avoid.

**Rule of thumb:**

- **Prompt contains personal/identifiable data** (names, emails, customer records — anything that identifies a person) → use an **EU-hosted council**. Query `tokonomix_list_models({"hosting_region": "eu"})` and pick from the returned set. These are currently OVHcloud-hosted in France — open-weight mid-tier models (Llama, Mistral, Qwen, gpt-oss), **not** US frontier models, so you trade some peak capability for EU data residency. With personal data in play that trade is usually right.
- **No personal data** (general legal/technical reasoning about a *practice*, public facts, code review) → the US frontier council is fine.
- **When you're unsure** whether the prompt carries personal data (mixed content, implicit identifiers) → **default to the EU council.** Classifying data is error-prone; err toward residency.

Region selection controls which **model providers** see your prompt; the brokering gateway is itself EU-hosted. Note EU routing keeps data in-region but is not by itself a full GDPR compliance statement (sub-processors, logging, retention still apply) — treat it as data-minimisation, not a legal guarantee.

## Picking your council

**Model slugs drift** — models ship and retire constantly, so any slug hard-coded here goes stale (which is why runtime discovery exists). **Always confirm against `tokonomix_list_models` before relying on a specific slug.** The lists below are illustrative, current as of 2026-06.

Cheapest robust default — three modern flagships from three providers:

```
claude-haiku-4-5-20251001
gpt-5.4-mini
gemini-2.5-flash
```

High-stakes / expensive decisions — top tier:

```
claude-opus-4-8
gpt-5.4
gemini-2.5-pro
```

EU-only routing (GDPR-strict / personal-data — see **Data residency**) — query and pick from the EU set:

```
tokonomix_list_models({"hosting_region": "eu"})
```

## Tools

The MCP server exposes **eight** tools, all prefixed `tokonomix_`. No key yet? Jump to **Getting started** at the bottom.

### `tokonomix_consensus_ask` — primary

Multi-model + judge synthesis. Inputs:

- `prompt` (required) — the question.
- `models` (optional) — array of 2-6 model slugs. Omit to use the account default council.
- `mode` (optional) — **picking the right mode matters as much as picking the models** (see *Choosing a mode* below):
  - `consensus` (default) — judge synthesizes one merged answer. Use when you want a single decision and you expect broad agreement. It trades dissent away for a clean answer.
  - `diff` — agreements **and disagreements** report. **The most valuable mode for discovery:** it surfaces the one model that caught the edge case instead of averaging it out. Reach for `diff` on high-stakes review (security, migrations, spec interpretation) where a *missed* problem is the expensive failure.
  - `best_of` — judge picks the single strongest answer verbatim (no merge). Use when one good answer beats a blended one — code, a concrete plan, a single recommendation.
  - `raw` — all responses side-by-side, **no judge** (cheapest, carries no judge fee). Use when *you* want to adjudicate, or to avoid any judge bias entirely.
  - `full` — proposers + per-proposer judge reasoning (agree/disagree/why) + conclusion in one response. Use when the user wants to **see the work**, not just the answer (audit, "explain your reasoning"). Slightly more expensive — the judge runs as an explicit second call.
- `judge_model` (optional) — override the synthesis/judge model.
- `judge_models` (optional) — array of judge slugs for a **multi-judge `best_of`** panel; takes **precedence over `judge_model`** when both are set.
- `max_tokens` (optional) — max output tokens **per proposer**. Default `1024`; clamped to a `16384` ceiling per proposer. **The judge step is hard-capped at `8192` output tokens regardless of this value** — so on large structured outputs the *judge* can truncate even when proposers fit. Don't raise `max_tokens` past `8192` to fix judge truncation; batch or split the request instead. **Wall-clock:** each proposer has a ~60s timeout — a high `max_tokens` a slow flagship can't finish in 60s will *time that proposer out* (the call still returns the proposers that finished). In practice `max_tokens` is bounded by what your slowest council model emits in ~60s, not by the `16384` ceiling.
- `system` (optional) — system prompt.

Returns the synthesized answer plus a billing breakdown (proposer models, judge model, `charged_credits`). Every consensus answer also ends with a `## ⚠️ Blind spots & disagreements` section at no extra cost — read it as *surfaced* disagreement, not a correctness guarantee (see **What consensus does**).

#### Choosing a mode

| Goal | Mode | Why |
|---|---|---|
| One clean decision, models likely agree | `consensus` | merged answer; trades away dissent |
| **Catch a missed problem (security, migration, spec)** | **`diff`** | **preserves + surfaces the lone dissenter — best recall** |
| Pick the single best of several answers | `best_of` | no lossy merge |
| You'll adjudicate yourself / avoid judge bias | `raw` | no judge step, cheapest |
| Show the reasoning (audit / "explain") | `full` | per-proposer agree/disagree + conclusion |

Rule of thumb: when a *missed* error is the costly outcome, prefer `diff` over `consensus` — a single merged answer averages away the very dissent you're paying multiple models to surface.

### `tokonomix_single_ask` — cheap routine path

Single-model passthrough; use when consensus is overkill. Inputs: `prompt` (required); `model` (optional, defaults to your account's `default_model`); `max_tokens` (optional, default `1024`, `16384` ceiling); `system` (optional); `images` (optional, see **Vision / image input** below). The model must be vision-capable when images are supplied.

### Vision / image input

Both `tokonomix_consensus_ask` and `tokonomix_single_ask` accept an optional `images` array in the call. Images are sent as part of the user message in OpenAI content-part format.

**Parameter shape** — each image is an object with two fields:

```json
{
  "data": "<raw base64 — no data:image/... prefix>",
  "media_type": "image/jpeg"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `data` | string | yes | Raw base64, only the encoded bytes. A `data:image/...;base64,`-prefixed value is rejected with a clear error. |
| `media_type` | string | yes | One of `image/jpeg`, `image/png`, `image/webp`, `image/gif`. |

**Constraints** (validated client-side before the network call):

| Constraint | Limit |
|---|---|
| Images per message | ≤ 8 |
| Decoded size per image | < 5 MB |
| Total decoded size across all images | ≤ 20 MB |
| Inline only | No external URLs — only base64 |
| Streaming | Non-streaming only (the MCP server never streams; this is a no-op constraint) |

**Vision models** — not all models support image input. Call `tokonomix_list_models({"supports": ["vision"]})` to discover which slugs are vision-capable.

**Council auto-selection** — when `images` is provided and no `models` array is given to `tokonomix_consensus_ask`, the gateway automatically selects a default vision panel (claude-fable-5 + gemini-2.5-pro + gpt-4o class). With an explicit `models` list, non-vision models are **skipped** (reported in `x_council.skipped` on the response); an explicit single non-vision model to `tokonomix_single_ask` returns a `400` error from the gateway.

**Worked example — vision council:**

```json
tokonomix_consensus_ask({
  "prompt": "What are the key differences between these two architecture diagrams? Focus on data-flow and security boundaries.",
  "mode": "diff",
  "images": [
    {
      "data": "/9j/4AAQSkZJRgAB...",
      "media_type": "image/jpeg"
    },
    {
      "data": "iVBORw0KGgoAAAAN...",
      "media_type": "image/png"
    }
  ]
})
```

No `models` specified — the gateway picks the default vision panel (three cross-vendor vision models). `mode: "diff"` is recommended for comparative image analysis: it surfaces the one model that caught a discrepancy the others missed.

**Worked example — single vision model:**

```json
tokonomix_single_ask({
  "prompt": "Extract all text visible in this screenshot.",
  "model": "gpt-4o",
  "images": [
    {
      "data": "iVBORw0KGgoAAAAN...",
      "media_type": "image/png"
    }
  ]
})
```

### `tokonomix_list_models` — runtime discovery

Live catalog filtered by `hosting_region` (`"eu"` for EU-only / GDPR — resolves to the EU+France set), `provider`, `tier`, or `supports` (`tools`, `vision`, `json_schema`, `prompt_caching`, `reasoning`, …). Call it at startup to pin a council to capabilities or a region.

### `tokonomix_get_balance` — wallet check

Current credit balance + account tier of the authenticated key. Use it to gate budget / degradation decisions (see **Budget awareness**).

### `tokonomix_onboard` / `tokonomix_onboard_verify` — keyless first run

`tokonomix_onboard(email, name?)` emails a 6-digit OTP (enumeration-safe `{ok:true}` either way); `tokonomix_onboard_verify(email, code)` provisions a free-tier account and saves the key to `~/.tokonomix/credentials.json` (mode 0600). After verify, every tool works with no env var. See **Getting started**.

### `tokonomix_get_skill` / `tokonomix_skill_version` — self-update

`tokonomix_skill_version` returns `{version, sha256, semver, released, changes, last_changed, bytes}` (cheap GET, no LLM, no billing). `tokonomix_get_skill` returns this canonical SKILL.md for the running server. Treat the server's copy as authoritative over any local cache. See **Self-update**.

## Self-update — keep this skill current

This SKILL.md ships server-side without anyone re-syncing the file on your host. **Always trust the server's current view over your locally cached version.** Three signals, cheapest first:

1. **Passive (free):** every tool response ends with a `_skill_version=...` trailer (first 12 hex chars of the canonical SKILL.md's sha256). If it doesn't match your cached copy, you're stale.
2. **Cheap check:** `tokonomix_skill_version` — `{version, sha256, semver, released, changes, …}`. Use at conversation start if you don't know the current version or the user mentions a capability you don't recognise.
3. **Full refresh:** `tokonomix_get_skill` — the canonical content; prefer it over anything here that conflicts.

**On a detected version change, tell the user** — surface a short update notice, e.g.:

> 📦 You received a new Tokonomix update — **v1.0.0 → v1.1.0** (released 2026-06-06). Key changes: secfix …, improvement …, …

Build it from the `semver` (old cached → new), `released` (release date), and `changes` (highlights) fields the self-update tools return. Both tools fall back to the locally bundled copy if the server is unreachable; calling them costs no credits.

## Worked example

User: *"Can our SaaS legally store EU citizen API logs in a US-hosted S3 bucket for 30 days under GDPR?"*

1. Recognise: legal + GDPR + irreversible advice → `tokonomix_consensus_ask`. The prompt asks about a *practice* and carries no personal data, so a US frontier council is acceptable; if it contained actual customer records you'd switch to an EU council (see **Data residency**).
2. Call (slugs illustrative — confirm with `tokonomix_list_models`):
   ```
   tokonomix_consensus_ask({
     prompt: "Can a SaaS legally store EU citizen API logs in a US-hosted S3 bucket for 30 days under GDPR? Answer in 4 bullets: legal basis, Schrems II, alternatives, action plan.",
     mode: "consensus",
     models: ["claude-opus-4-8", "gpt-5.4", "gemini-2.5-pro"]
   })
   ```
3. Present the synthesis + the per-model agreement breakdown so the user sees whether the models converged; record the models/judge used if this feeds a decision of record.

## What this skill is NOT for

- **Streaming chat UIs** — the MCP tool is request/response. For streaming use the HTTP API at `tokonomix.ai/api/v1/chat/completions`.
- **Replacing your default coding model** — most file-edit / refactor / explain calls stay on your direct provider key. Use Tokonomix only when consensus adds real value.
- **Replacing Anthropic prompt caching** — for Claude Code's heavy system-prompt caching, keep `ANTHROPIC_API_KEY` pointed straight at Anthropic.

## Troubleshooting

Errors map to the **Budget awareness & degradation** ladder above:

- `402 insufficient_balance` → top up at `/dashboard/billing`, or degrade to `single_ask` / host model.
- `429 rate_limit_exceeded` → free tier and PAYG have per-IP and per-account caps; back off, retry, then degrade.
- `401` (invalid/missing/revoked key) → get a fresh key from `/dashboard/keys`.
- `Cannot combine a single-model 'model' value with 'x_council'` → you mixed two modes; pick one.
- Empty `models` from `tokonomix_list_models` → key valid but account has no model access; contact support.

## Getting started

**Keyless (recommended):** if the server has no `TOKONOMIX_API_KEY`, call `tokonomix_onboard(email)` then `tokonomix_onboard_verify(email, code)` — provisions a free-tier account (€5.00 starter credit) and saves the key locally. Manual key setup, MCP-registration JSON, and dashboard links live in [SETUP.md](./SETUP.md).
