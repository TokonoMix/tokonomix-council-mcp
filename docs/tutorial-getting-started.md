# Tutorial: Your First Consensus Call

> Part of the [Council MCP](../README.md) documentation suite. This is the hands-on
> getting-started guide: install → make a first decision → read the verdict → rate
> it → run a first *grounded* review. The conceptual docs explain *why*; this one
> gets you to a real decision in a few minutes.

**30-second version.** Add the MCP server to your client, point it at a Tokonomix
key (or onboard keyless), and call `tokonomix_consensus_ask` on a real, small
decision. You get back several independent answers reconciled by an independent
judge — with the disagreement a single model would have hidden. Use it when a wrong
answer is expensive; use [`tokonomix_single_ask`](../README.md#tools) for routine
work.

Every tool name, parameter, and config key below matches the actual server
(`mcp-server/src/index.ts`).

---

## 1. Install and configure

### Get a key (or onboard keyless)

Sign up at [tokonomix.ai/dashboard/signup](https://tokonomix.ai/dashboard/signup)
(€5.00 free credit, no card) and issue a key at `/dashboard/keys` — it starts with
`tok_live_`.

Or onboard with **no key at all**, from inside your agent:

1. `tokonomix_onboard({ "email": "you@example.com" })` — emails a 6-digit code.
   (Enumeration-safe: it returns `{ok:true}` whether or not the email already has an
   account.) Optional: `name`, and `locale` (`en`/`nl`/`de`/`fr`/`es`/`tr`).
2. `tokonomix_onboard_verify({ "email": "you@example.com", "code": "123456" })` —
   provisions a free-tier account and saves the key to
   `~/.tokonomix/credentials.json` (mode `0600`). After this, every other
   `tokonomix_*` tool works with no env var.

### Add the server to your client

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

**Cursor / Cline / Continue / Zed** — the same `command` + `args` + `env` triple
goes in your tool's MCP-server config.

Configuration keys (all optional after keyless onboarding):

| Env var | Default | Purpose |
|---|---|---|
| `TOKONOMIX_API_KEY` | — | Bearer key, starts with `tok_live_` |
| `TOKONOMIX_BASE_URL` | `https://tokonomix.ai/api/v1` | Gateway base URL |
| `TOKONOMIX_SITE_URL` | derived from base | Main-app origin for keyless onboarding |

Sanity-check the connection with `tokonomix_get_balance` (no arguments) — it returns
your credit balance and account tier.

## 2. Make your first consensus call

Pick a **real, small decision where a wrong answer would cost you** — that is where
consensus earns its keep. Example:

```jsonc
{
  "prompt": "We have a UNIQUE constraint on (account_id, request_id). Is it safe to add ON CONFLICT DO UPDATE for an idempotent upsert, or could that mask a real duplicate bug? Decide and justify."
}
```

Call `tokonomix_consensus_ask` with that `prompt`. You did not pass `models`, so the
call uses your **per-key or per-account default council** — the recommended path.
(To pin a panel, pass `models` as 2–6 bare slugs from
`tokonomix_list_models`, e.g. `["claude-haiku-4-5-20251001", "gpt-5",
"gemini-2.5-flash"]`.)

The default `mode` is **`consensus`** — one merged, *decided* answer. The other
modes (pick by what you need):

- `diff` — an agreements/disagreements/confidence map; the judge **compares, it does
  not decide**.
- `raw` — every answer verbatim, **no judge** (cheapest).
- `best_of` — the judge picks the single strongest answer.
- `full` — every answer **plus** the judge's per-model reasoning and a conclusion.

See [Consensus](./consensus.md#2-pick-the-mode-by-intent) for choosing.

## 3. Read the verdict

The result carries the decision **and** an audit trail. Look for:

- the **synthesis** — the judge's reconciled answer (or, in `full`/`raw`, the
  per-model detail);
- **disagreement** — where the proposers diverged. *This is the high-value part.*
  Unanimous agreement is not proof (see [Confidence](./confidence.md)); a flagged
  disagreement is a real signal that the question is contestable;
- the **`request_id`** — shown in the billing line (`· request_id: …`) and in
  `x_council.request_id`. Keep it — you need it to rate the call;
- **cost** — `x_council.charged_credits`, the real total (proposers + judge).

If you pinned a panel and a model could not serve the request, it is reported in the
skipped list rather than silently dropped. (More: [Auditability](./auditability.md).)

## 4. Rate the call

Once you have seen whether the decision held up, rate it with
`tokonomix_rate_consensus` so model-utility scores reflect real outcomes:

```jsonc
{
  "request_id": "<from the call above>",
  "score": 8,
  "outcome": "correct",
  "consensus_benefit": "raised_confidence",
  "helped_model": "gemini-2.5-pro"
}
```

`request_id` and `score` (1–10) are required; `outcome`
(`correct`/`wrong`/`partial`), `findings` (real/false counts per `high`/`medium`/`low`
bucket), `consensus_benefit`, and `helped_model` are optional.

> **Honest note.** Rating is **server-gated** — per its contract,
> `tokonomix_rate_consensus` returns `404` until the platform feedback-loop is
> enabled on your account. If it 404s, the loop is simply off; the rest of your
> audit trail is unaffected.

## 5. A first grounded review

The biggest improvement to decision quality is **grounding** — giving the council
the *real artifact* instead of a description of it. Attach content **inline** via
`context.inline`:

```jsonc
{
  "prompt": "Does this handler leak the API key on the error path? Decide.",
  "context": {
    "inline": [
      { "path": "src/auth.ts", "lang": "ts", "content": "<the actual file contents here>" }
    ]
  }
}
```

The content goes to **all proposers and the judge**, so they reason over the same
real source. Attach the real thing, not a summary of it.

> **What is live today — be honest with yourself about this:**
> - **Inline context only.** `context.inline` is the grounding path, and it is
>   **server-gated** (honoured only when context-upload is enabled on the account).
> - **`tokonomix_upload`** (large-file / staged delivery, the `session`/`handles`
>   path) is **dormant** — it returns "not enabled". Use small inline payloads.
> - **The council does not fetch artifacts for you.** Provide the content yourself;
>   do not assume it will read a URL or repo on your behalf.
> - **The grounding-gate** (refusing to judge a thin, artefact-less prompt and
>   asking back with a single counter-question via `status:"needs_context"`) is
>   **dormant / shadow-first** — today a thin prompt still returns a best-effort
>   answer; do not depend on a counter-question arriving. For a genuinely
>   artefact-less question you may set `acknowledge_ungrounded: true` (with
>   `acknowledge_reason`) to force a best-effort verdict flagged
>   `grounding:insufficient`.
>
> Full detail: [Grounding](./grounding.md).

## 6. When to reach for consensus — and when not

- **Use consensus** when a missed error is expensive and asymmetric (security
  review, a migration direction, a legal/compliance or customer-facing claim), the
  question is genuinely contestable, and you can ground it.
- **Use [`tokonomix_single_ask`](../README.md#tools)** for routine reasoning,
  classification, or tool orchestration — it is one model call, cheaper and faster.
- **Be aware consensus can hurt:** on routine tasks it only adds cost (our benchmark
  shows it *ties* the best single model and beats it in no domain), and ungrounded
  agreement can launder a shared blind spot into false confidence. See
  [Failure Modes](./failure-modes.md) and [Recall vs Precision](./recall-vs-precision.md).

> **What Council is for.** It improves the **decision**; it does not execute,
> schedule, or run your work — that is [ANS](../README.md#council-in-the-tokonomix-ecosystem)'s
> job. And honestly: Council does **not** make models "more accurate" or "catch more
> bugs" — on SWE-bench it showed **no measurable net uplift in catch rate**. What it
> buys is variance-elimination, a verification layer, judge-independence, EU data
> residency, and grounding.

---

### Next steps

- [Decision Theory](./decision-theory.md) — why one model is one perspective.
- [Consensus](./consensus.md) — the modes, in depth.
- [Grounding](./grounding.md) — the strongest lever on decision quality.
- [Failure Modes](./failure-modes.md) — when consensus helps, doesn't, or hurts.
- [The Decision Engineering Manifesto](./decision-engineering-manifesto.md) — the full argument.
