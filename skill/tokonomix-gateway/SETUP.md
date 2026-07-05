# Setup — Tokonomix gateway (direct HTTP)

Get from zero to a working API call in under 60 seconds.

---

## Step 1 — Get an API key

**Option A — dashboard:**
1. Go to `https://tokonomix.ai` and sign up or log in.
2. Navigate to `Dashboard → API Keys → Create key`.
3. Copy the `tok_live_...` key. It is shown once.

**Option B — MCP onboarding (if you have MCP tools installed):**
```
tokonomix_onboard(email="you@example.com")
tokonomix_onboard_verify(email="you@example.com", code="123456")
```
This provisions a free-tier account and saves the key to
`~/.tokonomix/credentials.json`.

---

## Step 2 — Install the OpenAI SDK (recommended)

```bash
pip install openai          # Python
npm install openai          # Node.js / TypeScript
```

The Tokonomix gateway is fully OpenAI-compatible. You do not need a separate SDK.

---

## Step 3 — First call

**Python:**
```python
from openai import OpenAI

client = OpenAI(
    base_url="https://tokonomix.ai/api/v1",
    api_key="tok_live_...",
)

response = client.chat.completions.create(
    model="claude-sonnet-4-6",
    messages=[{"role": "user", "content": "Hello! What can you do?"}],
)
print(response.choices[0].message.content)
```

**curl:**
```bash
curl https://tokonomix.ai/api/v1/chat/completions \
  -H "Authorization: Bearer tok_live_..." \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-sonnet-4-6","messages":[{"role":"user","content":"Hello!"}]}'
```

---

## Environment variable setup

Set once; works with any OpenAI-compatible framework:

```bash
export OPENAI_BASE_URL=https://tokonomix.ai/api/v1
export OPENAI_API_KEY=tok_live_...
```

---

## Check your balance

```bash
curl https://tokonomix.ai/api/v1/balance \
  -H "Authorization: Bearer tok_live_..."
```

---

## Discover available models

```bash
curl https://tokonomix.ai/api/v1/models \
  -H "Authorization: Bearer tok_live_..."
```

---

## Next steps

- Read `SKILL.md` for all endpoints, consensus, image generation, EU routing,
  and Hermes/LangChain setup.
- For MCP tools (Claude Code, Cursor, Cline): see the `tokonomix-council-mcp`
  skill and run `npx tokonomix-council-mcp` to register the MCP server.
- For unattended runs: see `agents-never-sleep` at
  `https://github.com/TokonoMix/agents-never-sleep`.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `401 Unauthorized` | Check `Authorization: Bearer tok_live_...` header |
| `402 insufficient_balance` | Top up at `tokonomix.ai/dashboard/billing` |
| Image endpoint returns 503 | Run health probe: `GET /api/v1/images/generations/health` |
| Tool calls leak raw JSON | Use `/api/anthropic/v1/messages` for streaming + tools |
