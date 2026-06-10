# Tokonomix MCP — operator setup

Operator/install reference for the `tokonomix-consensus` skill. The agent-runtime guidance lives in [SKILL.md](./SKILL.md); this file is the one-time setup an operator does.

## Keyless first run (recommended)

No API key needed up front. From inside the conversation:

1. **`tokonomix_onboard(email, name?)`** — emails a 6-digit one-time code. The response is enumeration-safe (`{ok:true}` whether or not the address already has an account), so it never leaks who is registered.
2. **`tokonomix_onboard_verify(email, code)`** — verifies the code, provisions a free-tier account, and saves the issued key to `~/.tokonomix/credentials.json` (mode `0600`). The raw key is shown **once** — save it. The response also returns the starting credit balance.

After verify, every `tokonomix_*` tool works without any env var (the tools read the saved credentials file automatically).

## Manual key (CI / pinned key)

Register the `tokonomix-council-mcp` server with an explicit key:

```json
{
  "mcpServers": {
    "tokonomix": {
      "command": "npx",
      "args": ["-y", "tokonomix-council-mcp"],
      "env": {
        "TOKONOMIX_API_KEY": "tok_live_..."
      }
    }
  }
}
```

Get the key value from `https://tokonomix.ai/dashboard/keys`. Sign up at `/dashboard/signup` if you don't have an account.

## Accounts, billing, balance

- **Free tier:** €5.00 starter credit (~83 calls), no card required.
- **Top up / PAYG:** `/dashboard/billing`.
- **Cost shape:** `tokonomix_consensus_ask` bills every proposer **plus** the judge (small platform markup) — expect 2–15 cents/call depending on model mix and prompt size. `tokonomix_single_ask` bills one provider rate × markup — <1 cent for cheap models, a few cents for premium. Every response carries `charged_credits` in cents.
- **Balance at runtime:** `tokonomix_get_balance` (see Budget awareness in SKILL.md).
