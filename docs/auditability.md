# Auditability

> Part of the [Council MCP](../README.md) documentation suite. A decision you cannot
> inspect later is not a decision you can defend. Auditability is what separates a
> Council verdict from "an LLM said so."

**30-second version.** Every consensus call returns a trail: a stable request id,
which proposers ran, what each cost, and the synthesis. You can rate the call after
you see how it played out, so model-utility scores reflect real outcomes. What is
**not** captured: a byte-for-byte replay guarantee (models are non-deterministic).
Auditability here means *traceable and rateable*, not *bit-reproducible*.

![The decision lifecycle and rating feedback loop: Council produces a decision with a request id, an executor such as ANS acts on it, the outcome is observed, the call is rated by request id, and ratings feed model-utility reputation that informs future panel selection; the human stays accountable throughout.](./diagrams/decision-lifecycle.svg)

---

## 1. What every call records

A consensus call returns metadata in the `x_council` block and the billing line:

- **`request_id`** — a stable identifier for the call, shown in the billing
  breakdown (`· request_id: …`) and as `x_council.request_id`. It is the handle you
  use to [rate](#3-the-rating-feedback-loop) the call later.
- **per-model breakdown** — which proposers ran and what each contributed/cost.
- **`charged_credits`** — the real total cost (proposers + judge), so the price of
  the decision is recorded, never hidden.
- **skipped models** — when you pin an explicit panel, models that could not serve
  the request are reported rather than silently dropped, so you can see the panel you
  actually got.
- **the synthesis** — and, in [`full`](./consensus.md#2-pick-the-mode-by-intent)
  mode, the judge's per-model reasoning; in `raw`, every proposer answer verbatim.

Together these answer the audit questions: *who said what, who judged, on what
panel, at what cost.*

## 2. Traceability — tying a decision to an outcome

Auditability is only useful if you can connect the recorded decision back to what
happened next. The `request_id` is that connection: store it with whatever the
decision drove (a merged PR, a migration, a published statement), and you have a
durable link from "this is what we decided and why" to "this is how it turned out."

This is the same reason the
[ecosystem](../README.md#council-in-the-tokonomix-ecosystem) keeps **execution** in
ANS and **decision** in Council: the decision is recorded as its own artifact,
independent of the thing that acted on it.

## 3. The rating / feedback loop

You can rate a consensus call on real-world usefulness with
[`tokonomix_rate_consensus`](../README.md#tools), after you have seen the answer play
out. Supply the `request_id` and a `score` (1–10); optionally:

- **`helped_model`** — credit the one model whose minority or blind-spot view
  actually helped (the differentiator a single model would have hidden);
- **`outcome`** — `correct` / `wrong` / `partial`, the minimal validation signal;
- **`findings`** — the real/false split per severity bucket (`high`/`medium`/`low`,
  each `{real, false}`), the precision signal;
- **`consensus_benefit`** — a categorical verdict
  (`caught_blind_spot` / `resolved_disagreement` / `raised_confidence` /
  `no_added_value` / `consensus_was_wrong`).

These feed the agent-utility reputation scores that inform
[decorrelation-aware selection](./routing.md).

> **Honest status.** The rating endpoint is **server-gated**: per its contract it
> returns `404` until the platform feedback-loop is enabled. If a rating call 404s,
> the loop is off for your account — record the `request_id` anyway; the rest of the
> audit trail does not depend on rating being live. (Privacy: the free-text `note`
> field is accepted for convenience but **not stored**.)

## 4. What is NOT auditable — reproducibility, honestly

Be precise about the limit:

- **No bit-for-bit replay.** LLMs are non-deterministic; re-running the same prompt
  on the same panel can produce a different answer. The audit trail captures *what
  was decided and on what basis*, not a guarantee that re-running reproduces it
  verbatim. (Our [benchmarks](./benchmark-methodology.md) are reproducible at the
  *methodology* level — same harness, same datasets, same metrics — not at the
  single-call level.)
- **Auditability is not correctness.** A fully recorded decision can still be wrong
  (see [Failure Modes](./failure-modes.md)). The trail lets you *review* the
  decision; it does not validate it.
- **The human stays accountable.** The trail exists so a person or agent can answer
  for the decision later — it documents responsibility, it does not replace it.

---

### See also

- [Architecture](./architecture.md) — where the trail is produced in the pipeline.
- [Confidence](./confidence.md) — reading the recorded agreement/disagreement.
- [Benchmark Methodology](./benchmark-methodology.md) — reproducibility at the right level.
- [Failure Modes](./failure-modes.md) — why a recorded decision can still be wrong.
