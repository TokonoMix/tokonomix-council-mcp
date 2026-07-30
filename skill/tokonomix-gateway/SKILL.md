---
name: tokonomix-gateway
version: 1.0.0
released: 2026-06
description: >-
  Direct HTTP access to the Tokonomix AI gateway — OpenAI- and Anthropic-compatible
  endpoints for chat, image generation, image editing, vision consensus, embeddings,
  audio transcription and reranking, with EU data-residency routing through one key.
  Use when building an app, an agent framework, or a CI pipeline without MCP. For MCP
  tool use see tokonomix-council-mcp; for unattended backlog runs see agents-never-sleep.
---

# Tokonomix Gateway — Direct HTTP

One key. All providers. Every modality.

The Tokonomix gateway is an OpenAI-compatible (and Anthropic-compatible) AI
gateway that routes to Anthropic, OpenAI, Google, Mistral, xAI, Azure EU, and
open-weight models through a single `tok_live_...` API key. It also adds
multi-model consensus, EU data-residency routing, and live spend tracking on top
of the standard API surface.

## When to use this skill vs the MCP

| Situation | Recommended approach |
|---|---|
| Building an app / agent framework / CI pipeline | **This skill** — direct HTTP |
| Using Claude Code, Cursor, Cline, or any MCP host | `tokonomix-council-mcp` (MCP tools) |
| Running an unattended backlog of tickets overnight | `agents-never-sleep` |
| Migrating an existing OpenAI app to multi-vendor | **This skill** — drop-in base_url swap |
| You need tool-calling + streaming simultaneously | `/api/anthropic/v1/messages` endpoint (below) |

## Authentication

Every endpoint (except health probes) requires a Bearer token:

```
Authorization: Bearer tok_live_...
```

**Get a key:**

1. Visit `https://tokonomix.ai/dashboard/keys` (login or sign up first).
2. Or use the keyless onboarding via the MCP tools (`tokonomix_onboard`).

Keys carry per-key settings: a default council, monthly spend cap, and optional
restrictions on models/modes/regions. Set guardrails once on the key; they apply
to every call.

Credentials are saved to `~/.tokonomix/credentials.json` (mode 0600) by the MCP
onboarding flow. When both a file and `TOKONOMIX_API_KEY` env var are present, the
env var takes precedence.

## OpenAI drop-in

Swap `base_url` in the OpenAI SDK. No other changes needed:

**Python:**
```python
from openai import OpenAI

client = OpenAI(
    base_url="https://tokonomix.ai/api/v1",
    api_key="tok_live_...",
)

response = client.chat.completions.create(
    model="claude-sonnet-4-6",
    messages=[{"role": "user", "content": "Explain zero-knowledge proofs in 3 sentences."}],
)
print(response.choices[0].message.content)
```

**TypeScript / Node:**
```typescript
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://tokonomix.ai/api/v1",
  apiKey: "tok_live_...",
});
```

**Environment variables (for frameworks that read them):**
```bash
OPENAI_BASE_URL=https://tokonomix.ai/api/v1
OPENAI_API_KEY=tok_live_...
```

Any framework or library that honours `OPENAI_BASE_URL` routes through Tokonomix
with no code changes.

## Anthropic drop-in

Use the Anthropic Python or TypeScript SDK with `base_url` set:

**Python:**
```python
import anthropic

client = anthropic.Anthropic(
    base_url="https://tokonomix.ai/api/anthropic",
    api_key="tok_live_...",
)
```

**TypeScript:**
```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  baseURL: "https://tokonomix.ai/api/anthropic",
  apiKey: "tok_live_...",
});
```

Use the Anthropic endpoint specifically when you need **tool-calling + streaming
simultaneously** — the OpenAI-compatible endpoint cannot stream tool calls.

## Chat completions — single model

```
POST https://tokonomix.ai/api/v1/chat/completions
```

OpenAI-compatible. Pass any model slug returned by `GET /api/v1/models`.

```json
{
  "model": "claude-sonnet-4-6",
  "messages": [
    {"role": "system", "content": "You are a concise assistant."},
    {"role": "user", "content": "What is the capital of France?"}
  ],
  "stream": true
}
```

**Streaming** works the same as OpenAI SSE — `data: {...}` lines, ending with
`data: [DONE]`.

**Tool / function calling** is supported on the OpenAI endpoint for non-streaming
calls. For streaming + tools simultaneously, use the Anthropic endpoint instead.

**Prompt caching** passes through on the Anthropic endpoint — Anthropic
`cache_control` breakpoints are forwarded to the provider and billed at cache-read
rates on repeat calls. OpenAI auto-caching is likewise honoured.

## Chat completions — multi-model consensus (HTTP)

Add `mode` and optionally `x_council` to any `/chat/completions` request to run
multiple models and have a judge synthesize the result:

```json
{
  "model": "consensus",
  "messages": [{"role": "user", "content": "Is this migration safe?\n\nALTER TABLE users ADD COLUMN tier INT DEFAULT 0 NOT NULL;"}],
  "mode": "diff",
  "x_council": {
    "models": ["claude-sonnet-4-6", "gpt-5.4-mini", "gemini-2.5-flash"],
    "judge_models": ["claude-opus-4-8"]
  }
}
```

**`mode` values:**

| Mode | Use when |
|---|---|
| `consensus` (default) | One clean merged answer; models broadly agree |
| `diff` | **Best for review** — surfaces the model that caught the edge case instead of averaging it away |
| `best_of` | Judge picks the single strongest verbatim answer; good for code |
| `raw` | All responses side-by-side, no judge step (cheapest) |
| `full` | Proposers + per-proposer judge reasoning; use for audit/explain |

**`x_council` fields:**

| Field | Type | Notes |
|---|---|---|
| `models` | string[] | 2–6 model slugs; omit to use account default |
| `judge_model` | string | Single judge override |
| `judge_models` | string[] | Multi-judge panel (takes precedence over `judge_model`) |

**Omit `x_council` entirely** to use the account's default council — one API key
setting covers all your calls.

The response includes `x_council` metadata: proposer models used, judge model,
`request_id` (for introspection), `charged_credits`, and a `## ⚠️ Blind spots &
disagreements` section at no extra cost.

## Vision input

Send images as OpenAI content-parts in the `messages` array:

```json
{
  "model": "gpt-4o",
  "messages": [{
    "role": "user",
    "content": [
      {"type": "text", "text": "What is wrong with this architecture diagram?"},
      {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,/9j/4AAQ..."}}
    ]
  }]
}
```

**base64 format:** `data:<mime_type>;base64,<encoded_bytes>` — include the full
data-URI prefix for OpenAI-compat calls.

**Vision models:** not all models support image input. Check `GET /api/v1/models`
for `capabilities.vision`.

**Auto council selection for vision:** when `mode: "consensus"` and no `models`
array is given, the gateway automatically selects a cross-vendor vision panel.
Non-vision models in an explicit list are silently skipped (reported in
`x_council.skipped`).

## Image generation

```
POST https://tokonomix.ai/api/v1/images/generations
```

OpenAI-compatible. Probe the health endpoint before billing a call:

```
GET https://tokonomix.ai/api/v1/images/generations/health
```
Returns `{"status":"ok"}` or `{"status":"disabled"}` — no authentication needed.

**Python (OpenAI SDK):**
```python
response = client.images.generate(
    model="gpt-image-2",
    prompt="A photorealistic sunset over Amsterdam canals",
    n=1,
    size="1024x1024",
)
image_b64 = response.data[0].b64_json
```

**JSON body:**
```json
{
  "model": "gpt-image-2",
  "prompt": "A photorealistic sunset over Amsterdam canals",
  "n": 1,
  "size": "1024x1024"
}
```

**Available models:** fetch `GET /api/v1/image-capabilities` (no auth) for the live
list with per-model capabilities and gotchas.

**Gotchas:**
- **Do not pass `response_format`** — gpt-image-1/2 do not support it; the gateway
  strips it automatically and always returns `b64_json`.
- **Do not use fal_client, Replicate, or a dedicated image SDK** — the OpenAI SDK
  `images.generate()` works natively via the base_url swap.
- Gemini models may return empty responses when the prompt triggers a safety filter.

**Gemini editing via this endpoint:** Gemini models support image editing through
`/images/generations` with a `base64` image field in the JSON body (see below —
they do NOT support the `/images/edits` multipart endpoint):

```json
{
  "model": "gemini-2.5-flash-image",
  "prompt": "Make the sky look like a Van Gogh painting",
  "image": "<base64-encoded-image-bytes>",
  "image_mime_type": "image/jpeg"
}
```

## Image editing

```
POST https://tokonomix.ai/api/v1/images/edits
```

Multipart `form-data`. Supported by OpenAI-family models only (gpt-image-1/2).

**Python (requests — OpenAI SDK `client.images.edit()` also works for OpenAI models):**
```python
import requests

with open("photo.png", "rb") as f:
    r = requests.post(
        "https://tokonomix.ai/api/v1/images/edits",
        headers={"Authorization": "Bearer tok_live_..."},
        files={"image": ("photo.png", f, "image/png")},
        data={"model": "gpt-image-2", "prompt": "Add a rainbow in the sky", "n": "1"},
    )
image_b64 = r.json()["data"][0]["b64_json"]
```

**Gotchas:**
- **Do NOT set `Content-Type` manually.** Let `requests`/`fetch` set it
  automatically so the multipart boundary is included. A manually-set
  `Content-Type` omits the boundary and causes a 400 parse error.
- `/images/edits` is a separate endpoint with its own pricing — not the same as
  `/images/generations`. Check `capabilities.image_editing` on the model.
- Gemini models do not support this endpoint; use `/images/generations` with a
  base64 `image` field instead (see above).

## Image consensus

A two-step pattern: generate an image, then run a vision council to review it.

**Step 1 — generate:**
```python
gen = client.images.generate(
    model="gpt-image-2",
    prompt="Product photo: a minimalist water bottle on a white background",
    n=1,
    size="1024x1024",
)
image_b64 = gen.data[0].b64_json
```

**Step 2 — vision consensus review:**
```json
POST /api/v1/chat/completions
{
  "model": "consensus",
  "mode": "diff",
  "messages": [{
    "role": "user",
    "content": [
      {"type": "text", "text": "Review this generated product image for brand-safety and quality issues. Flag anything a human reviewer should check."},
      {"type": "image_url", "image_url": {"url": "data:image/png;base64,<image_b64>"}}
    ]
  }],
  "x_council": {
    "models": ["claude-sonnet-4-6", "gpt-4o", "gemini-2.5-flash"]
  }
}
```

`diff` mode is recommended: it surfaces the one model that caught a brand-safety
issue the others missed, rather than averaging it away.

## Embeddings

```
POST https://tokonomix.ai/api/v1/embeddings
```

OpenAI-compatible.

```python
response = client.embeddings.create(
    model="text-embedding-3-small",
    input="The quick brown fox jumps over the lazy dog",
)
vector = response.data[0].embedding
```

```json
{
  "model": "text-embedding-3-small",
  "input": ["first sentence", "second sentence"]
}
```

## Audio transcription (STT)

```
POST https://tokonomix.ai/api/v1/audio/transcriptions
```

OpenAI-compatible multipart.

**Python (OpenAI SDK):**
```python
with open("recording.mp3", "rb") as audio_file:
    transcript = client.audio.transcriptions.create(
        model="whisper-1",
        file=audio_file,
        language="nl",  # optional ISO-639-1 hint
    )
print(transcript.text)
```

**curl:**
```bash
curl https://tokonomix.ai/api/v1/audio/transcriptions \
  -H "Authorization: Bearer tok_live_..." \
  -F model=whisper-1 \
  -F file=@recording.mp3
```

## Reranking

```
POST https://tokonomix.ai/api/v1/rerank
```

Cohere / Voyage-compatible format.

```json
{
  "model": "rerank-english-v3.0",
  "query": "How do I reset my password?",
  "documents": [
    "To reset your password, go to Settings → Security.",
    "Our refund policy is valid for 30 days.",
    "Password recovery emails are sent within 2 minutes."
  ],
  "top_n": 2
}
```

Response: ranked document list with relevance scores.

## Model discovery

```
GET https://tokonomix.ai/api/v1/models
GET https://tokonomix.ai/api/v1/providers
```

Both require Bearer auth.

**`/api/v1/models`** returns all active model slugs with capabilities, pricing, and
region info. Use it to discover current slugs — **do not hardcode model slugs**,
the catalog changes as providers add or retire models.

**`/api/v1/providers`** returns the provider list with routing info.

**Filtering by capability (via query params):**
```
GET /api/v1/models?supports=vision
GET /api/v1/models?supports=tools
GET /api/v1/models?hosting_region=eu
```

**OpenAI SDK:**
```python
models = client.models.list()
for model in models:
    print(model.id, model.capabilities if hasattr(model, "capabilities") else "")
```

## Budget awareness

```
GET https://tokonomix.ai/api/v1/balance
```

Returns current credit balance and month-to-date usage.

**Response:**
```json
{
  "balance_cents": 4820,
  "currency": "EUR",
  "month_to_date": {
    "charged_cents": 180,
    "tokens": 12480000
  }
}
```

**Every `/chat/completions` response includes** `charged_credits` in the `x_council`
block (consensus) or `usage` (single model). Track both the € cost and token
throughput ceilings — degrade as soon as you approach the first of the two.

**Degradation ladder** when credits run low:
1. Full consensus → single model (`/chat/completions` with a `model` slug)
2. Single model → your host model (no Tokonomix call)
3. Proceed and flag the answer as unverified

**Error → ladder mapping:**
- `402 insufficient_balance` → drop to single model or host model; top up at `/dashboard/billing`
- `429 rate_limit_exceeded` → back off, retry, then degrade
- `401` → get a fresh key from `/dashboard/keys`
- `5xx` → retry once, then degrade

## Usage introspection

```
GET https://tokonomix.ai/api/v1/generation?id=<request_id>
```

Per-call cost breakdown: models used, tokens, charged credits, timing. The
`request_id` is returned in `x_council.request_id` on consensus calls and in the
`x-request-id` response header on all calls.

## EU data residency

For prompts that contain personal or identifiable data (names, emails, customer
records), route to EU-hosted models:

```json
{
  "model": "consensus",
  "messages": [...],
  "x_council": {
    "hosting_region": "eu"
  }
}
```

Or filter at model selection:
```
GET /api/v1/models?hosting_region=eu
```

EU models are currently hosted on OVHcloud (France) — open-weight mid-tier models
(Llama, Mistral, Qwen, gpt-oss). They trade some peak capability for EU data
residency, which is usually the right trade when personal data is in the prompt.

EU routing keeps data in-region but is not by itself a full GDPR compliance
statement. Treat it as data-minimisation, not a legal guarantee.

## Hermes / OpenAI-compatible agent setup

Any agent framework that supports an OpenAI-compatible endpoint works out of the
box. Set `OPENAI_BASE_URL` and your Tokonomix key:

**Hermes (or any OpenAI-compat agent):**
```python
import os
os.environ["OPENAI_BASE_URL"] = "https://tokonomix.ai/api/v1"
os.environ["OPENAI_API_KEY"] = "tok_live_..."

# Framework picks up the env vars — no other config needed
from hermes import Agent
agent = Agent(model="claude-sonnet-4-6")
```

**LangChain:**
```python
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    openai_api_base="https://tokonomix.ai/api/v1",
    openai_api_key="tok_live_...",
    model_name="claude-sonnet-4-6",
)
```

**LlamaIndex:**
```python
from llama_index.llms.openai import OpenAI

llm = OpenAI(
    api_base="https://tokonomix.ai/api/v1",
    api_key="tok_live_...",
    model="claude-sonnet-4-6",
)
```

**Note for tool-calling agents:** if your agent framework uses OpenAI-format tool
calls with streaming simultaneously, switch the client to point to the Anthropic
endpoint instead:

```python
import anthropic

client = anthropic.Anthropic(
    base_url="https://tokonomix.ai/api/anthropic",
    api_key="tok_live_...",
)
```

The Anthropic endpoint supports tool-calling + streaming simultaneously; the
OpenAI-compat endpoint does not.

**Image generation from within an agent:** use `/api/v1/images/generations` (or
`/images/edits`) as a standard HTTP call — there is no Anthropic-native image-gen
API, so the two endpoints are independent and can be mixed in the same session.

## Capabilities guide

```
GET https://tokonomix.ai/api/v1/capabilities
```

Machine-readable JSON guide listing every endpoint, SDK examples, gotchas, and the
current image capability matrix. Fetch once per session and cache for an hour:

```python
guide = client.get("https://tokonomix.ai/api/v1/capabilities").json()
```

## Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `401 Unauthorized` | Missing or invalid key | Check `Authorization: Bearer tok_live_...` |
| `402 insufficient_balance` | Credits exhausted | Top up at `/dashboard/billing`; degrade to host model |
| `429 rate_limit_exceeded` | Per-key or per-IP cap hit | Back off, retry, then degrade |
| `400` on `/images/edits` | Content-Type boundary missing | Don't set `Content-Type` manually |
| `400` on `/images/edits` for Gemini | Wrong endpoint | Use `/images/generations` with `image` base64 field |
| Empty image response | Safety filter triggered | Check model, rephrase prompt |
| Tool calls leak raw JSON | Streaming + tools on OpenAI endpoint | Switch to `/api/anthropic/v1/messages` |
| Slug not found | Model retired or not yet live | Fetch `/api/v1/models` and pick a current slug |

## Related skills

- **`tokonomix-council-mcp`** — MCP tools (`tokonomix_consensus_ask` etc.) for
  Claude Code, Cursor, Cline, Continue, and other MCP hosts. Comes in the same
  npm package as this skill.
- **`agents-never-sleep`** — unattended backlog runner. Uses the gateway via the
  MCP tools and optionally direct HTTP. Get it:
  `git clone https://github.com/TokonoMix/agents-never-sleep`
