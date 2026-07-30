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

## Optional: dev-host consensus reminder hook (opt-in, never auto-installed)

A skill is *pull-only* — the host model decides when to call it. If you want a
gentle, opt-in **nudge** before high-stakes actions in an interactive coding host
(Claude Code), add a hook that pattern-matches high-stakes signals and injects a
one-line reminder to consider a cross-vendor consensus check. This is **opt-in**:
copy the snippet below into your host's hook config yourself; the skill never
installs it for you.

**Unattended safety (load-bearing):** the hook **never blocks**. It only prints a
reminder to stderr. When `CLAUDE_UNATTENDED=1` it is *nudge-only* by construction
(stderr note, exit 0) so an unattended / ANS run is never hard-gated — the
per-key `consensus_policy` (set on your Tokonomix key) is the real pre-declared
profile for unattended jobs, not this interactive hook.

Save as `~/.claude/hooks/consensus-reminder.sh` (`chmod +x`):

```bash
#!/usr/bin/env bash
# Opt-in Tokonomix consensus reminder. NEVER blocks — nudge-only (exit 0 always).
# Reads the tool/prompt payload on stdin (Claude Code PreToolUse / UserPromptSubmit).
# All output goes to STDERR only (never stdout) so it can neither inject host
# context nor emit a control directive — it is purely informational.
set -uo pipefail   # NOTE: no -e; this hook must never abort on a failed command.
payload="$(cat || true)"

# High-stakes signal patterns: DB migrations, git push, money/flag flips,
# auth/crypto, DDL, prod deploys. Extend to taste.
pattern='git[[:space:]]+push|drizzle-kit[[:space:]]+(migrate|generate)|ALTER[[:space:]]+TABLE|CREATE[[:space:]]+TABLE|DROP[[:space:]]+TABLE|ENABLE_[A-Z]|charge|invoice|billing|secret|private[_-]?key|encrypt|deploy.*prod|systemctl[[:space:]]+restart'

# Use a here-string (no pipe) so grep -q exiting early can't SIGPIPE a producer
# under pipefail and silently drop the nudge. `|| true` keeps it non-fatal.
if grep -qiE "$pattern" <<<"$payload" 2>/dev/null; then
  # Identical behaviour interactive or unattended: stderr nudge, never a block.
  # CLAUDE_UNATTENDED is honoured by construction — there is no blocking path.
  printf '%s\n' \
    '💡 High-stakes action detected. Consider a cross-vendor consensus check (tokonomix_consensus_ask, mode:diff) before committing to this — one real catch on auth/migrations/money pays for the call.' >&2
fi
exit 0   # ALWAYS 0 — this hook informs, it never gates (interactive or unattended).
```

Wire it in `~/.claude/settings.json` (PreToolUse on Bash, plus UserPromptSubmit):

```jsonc
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Bash", "hooks": [
        { "type": "command", "command": "~/.claude/hooks/consensus-reminder.sh" }
      ]}
    ],
    "UserPromptSubmit": [
      { "hooks": [
        { "type": "command", "command": "~/.claude/hooks/consensus-reminder.sh" }
      ]}
    ]
  }
}
```

The hook is a *reminder*, not a policy engine. The authoritative, unattended-safe
policy is the per-key `consensus_policy` you set on your key
(`off` / `adaptive` / `aggregate_only` / `per_item` / `mandatory_high_stakes`;
default `adaptive`) — that travels with the key into every job and is never an
interactive block.

## Accounts, billing, balance

- **Free tier:** €5.00 starter credit (~83 calls), no card required.
- **Top up / PAYG:** `/dashboard/billing`.
- **Cost shape:** `tokonomix_consensus_ask` bills every proposer **plus** the judge (small platform markup) — expect 2–15 cents/call depending on model mix and prompt size. `tokonomix_single_ask` bills one provider rate × markup — <1 cent for cheap models, a few cents for premium. Every response carries `charged_credits` in cents.
- **Balance at runtime:** `tokonomix_get_balance` (see Budget awareness in SKILL.md).
