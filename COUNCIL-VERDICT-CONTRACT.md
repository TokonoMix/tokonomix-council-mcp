# Structured council-verdict contract (dormant)

> Status: **contract only — not yet emitted by the gateway, not republished.** This formalizes the
> machine-readable verdict shape so the Agents-Never-Sleep harness can derive its trust-gate from the
> council's own output instead of an agent's self-report. The consumer side ships dormant behind
> `council.structured_verdict` (default OFF) in the ANS harness; flipping it on + the gateway emitting
> this block is the Mes-supervised go-live step.

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
  "overall": "pass" | "concerns" | "error",   // optional — derived from issues[] when absent
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

## How the harness derives the gate (the consumer, already built)

`harness/council.py:verdict_from_structured()` — **fail-safe**, mirroring the existing
`_coerce_verdict`/`reconcile` posture:

- malformed artifact, or **no proposer ran** → `error` (a blind spot withholds trust);
- a **material open issue** (`severity` ∈ {critical, high, medium}, `status` ≠ resolved) forces
  `concerns` — it can only DOWNGRADE an explicit `overall`, never upgrade it (a self-declared `pass`
  that still carries an open HIGH becomes `concerns`);
- an unrecognized `overall` → `concerns` (never silently trusted);
- otherwise → `pass`.

The derived verdict then runs through the unchanged `dispose()` tiering (HEAVY + not-pass → daylight
review). The deterministic gate stays the only HARD gate; this never reverts.

## Producer obligations (gateway — parked)

To emit this block the gateway must instruct the **independent judge** to return per-issue findings
as structured output (severity + status) alongside the prose synthesis, and surface `proposers`/
`judge` from the metadata it already tracks. That is a gateway prompt/response change requiring a
republish; it is intentionally **not** done here. Until then `overall`/`issues` are absent and the
harness keeps using the agent's `--council-verdict` (flag OFF).
