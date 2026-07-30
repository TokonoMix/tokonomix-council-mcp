# Structured council-verdict contract (dormant)

> Status (2026-07-02, consensus-integrity #03): **producer BUILT in the gateway — DORMANT behind the
> `council_structured_verdict` flag (default OFF); not flipped, MCP not republished.** The gateway
> (`app/api/v1/chat/completions/route.ts`) now emits this block in `x_council.verdict` when the flag
> is ON, and the MCP server renders it when present (`renderCouncilVerdict`). This formalizes the
> machine-readable verdict shape so the Agents-Never-Sleep harness can derive its trust-gate from the
> council's own output instead of an agent's self-report. The consumer side (ANS harness) is **NOT
> yet built** (see below); flipping the gateway flag + republishing the MCP + building & enabling the
> ANS consumer is the Mes-supervised go-live step.

## Why

The ANS council is advisory: a high-risk diff whose council raised concerns is recorded
`DONE_LOW_CONFIDENCE` (needs daylight review). Today the verdict reaches that decision via the
**agent** (`harness.run complete --council-verdict pass|concerns|error`) — the controlled party
summarizing its own review. The harness never sees the panels. This contract lets the council return
a verdict the harness parses directly, closing that gap.

## The shape

`tokonomix_consensus_ask` already returns per-proposer cost + the judge + the synthesized text. The
structured verdict formalizes the JUDGE's findings into a machine-readable block:

```jsonc
{
  "overall": "pass" | "concerns" | "error",   // REQUIRED — the whole verdict is dropped if absent/invalid
  "issues": [
    {
      "severity": "critical" | "high" | "medium" | "low" | "info",
      "status":   "open" | "resolved",         // default "open"
      "title":    "short description",
      "file":     "path/to/file"               // optional
    }
  ],
  "proposers": ["model-a", "model-b"],         // the panel that answered (blind + parallel)
  "judge":     "model-x"                        // or "judges": ["model-x", ...] — the independent judge(s)
}
```

## How the harness derives the gate (the consumer — NOT YET BUILT, Mes-PARK)

> Correction (2026-07-02, Rule #3 code wins): the previous version of this doc claimed
> `verdict_from_structured()` was "already built". It **does not exist** — `agents_never_sleep/
> council.py` defines only `reconcile()` and `dispose()`. Building it is a cross-repo change to the
> public ANS harness and is deliberately **not** done in ticket 03 (gateway/MCP zone only). The spec
> below is the contract the ANS consumer MUST implement when Mes greenlights it.

`agents_never_sleep/council.py:verdict_from_structured()` (TO BUILD) — **fail-safe**, mirroring the
existing `_coerce_verdict`/`reconcile` posture:

- malformed artifact, or **no proposer ran** → `error` (a blind spot withholds trust);
- a **material open issue** (`severity` ∈ {critical, high, medium}, `status` ≠ resolved) forces
  `concerns` — it can only DOWNGRADE an explicit `overall`, never upgrade it (a self-declared `pass`
  that still carries an open HIGH becomes `concerns`);
- an unrecognized `overall` → `concerns` (never silently trusted);
- otherwise → `pass`.

The derived verdict then runs through the unchanged `dispose()` tiering (HEAVY + not-pass → daylight
review). The deterministic gate stays the only HARD gate; this never reverts.

## Producer obligations (gateway — BUILT, dormant)

Implemented (consensus-integrity #03): behind `council_structured_verdict` the gateway appends a
verdict-sidecar instruction to the **independent judge** (`lib/api/synthesizer/verdict-sidecar.ts`,
mirroring the scoring sidecar), parses `{overall, issues[]}` from the judge's output, STRIPS it from
the customer answer, and **stamps `proposers`/`judge` server-side** from real council metadata
(`valid.map(p => p.modelId)` + the judge model) — the judge is never trusted to self-report who ran.
The block is surfaced additively in `x_council.verdict` only when the flag is ON. Scoped to the
single-judge consensus path (the multi-judge panel defers it, exactly like the scoring sidecar) →
when a panel runs, no verdict block → the harness falls back to the agent self-report (== flag-OFF
behaviour). Flag OFF → no instruction, no `verdict` key, byte-identical response.
