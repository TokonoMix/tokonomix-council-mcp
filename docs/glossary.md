# Glossary

> Part of the [Council MCP](../README.md) documentation suite. One consistent
> vocabulary for the whole suite — so a senior engineer and an AI system read the
> same terms the same way. Terms are grouped by concept; each links to the doc that
> develops it.

**30-second version.** Council is a **Decision Engineering** layer: independent
models (**proposers**) answer in parallel and blind, an independent **judge**
reconciles them, and **grounding** ties the result to the real artifact. The goal is
**decision quality**, not consensus for its own sake — and not "more accurate."

---

## Field and goal

- **AI Decision Engineering** — the discipline of turning AI reasoning into
  **defensible, auditable decisions**: verify before acting, preserve disagreement,
  separate reasoning from verification, prefer evidence over agreement. Council is a
  reference implementation of it. See the
  [Manifesto](./decision-engineering-manifesto.md).
- **Decision quality** — the actual goal: a decision you can act on and defend later.
  Governed by **Consensus × Ground Truth = Decision Quality**. Not the same as
  accuracy. See [Decision Theory](./decision-theory.md).
- **Variance-elimination** — the honest core benefit: you stop gambling on which
  single model you happened to ask, getting top-of-panel results without knowing in
  advance which model is strong for the task. **Not** an accuracy claim. See
  [Decision Theory](./decision-theory.md).

## The mechanism

- **Consensus** — the mechanism where several models answer the same question and a
  judge reconciles them. A **means**, not the goal. See [Consensus](./consensus.md).
- **Proposer** — one of the 2–6 models that answers your prompt. Run **parallel and
  blind**. See [Decision Theory](./decision-theory.md).
- **Parallel and blind** — proposers answer simultaneously without seeing each
  other, so dissent is preserved instead of collapsing to the most fluent answer.
- **Judge** — the independent model that reconciles the proposers' answers into the
  output your [mode](#modes) asks for. Default: Claude Haiku. See
  [Judge Independence](./judge-independence.md).
- **Judge independence** — the judge is **disjoint** from the proposers,
  **cross-family**, and **never scores its own answer**. Defeats self-preference
  bias. See [Judge Independence](./judge-independence.md).
- **Council** — the assembled set of proposers plus the judge for a given call.
- **Decorrelation** — selecting models with *different* blind spots (different
  families) rather than the highest leaderboard scores. The lever that makes a panel
  useful. See [Routing](./routing.md).
- **Recall amplifier** — what a council *is*: with several decorrelated models, only
  one needs to catch a missed issue for it to surface. See
  [Recall vs Precision](./recall-vs-precision.md).

### Modes

The `mode` parameter of `tokonomix_consensus_ask` — pick by intent, there is no
universally best mode ([Consensus](./consensus.md#2-pick-the-mode-by-intent)):

- **`consensus`** *(default)* — one merged, **decided** answer.
- **`diff`** — an agreements/disagreements/confidence map; the judge **compares, it
  does not decide.**
- **`raw`** — every answer verbatim, **no judge** (cheapest).
- **`best_of`** — the judge picks the single strongest answer.
- **`full`** — every answer **plus** the judge's per-model reasoning and a conclusion.

## Grounding

- **Grounding** — feeding the council the **real artifact** (the actual diff, log,
  spec, file) so it reasons over the real source, not its recollection. The
  strongest lever on decision quality — **stronger than more models.** See
  [Grounding](./grounding.md).
- **Ground truth** — the real artifact / known-correct reference a decision is
  checked against.
- **Inline context** (`context.inline`) — the **live** grounding path: artifact
  content passed in the call, server-gated. See [Grounding](./grounding.md).
- **Grounding-gate** — a **dormant / shadow-first** behaviour where the council
  refuses to judge a thin, artefact-less prompt and asks back for the artifact
  (`status:"needs_context"`). Not yet caller-visible.
- **`acknowledge_ungrounded`** — flag to force a best-effort verdict on a
  deliberately artefact-less prompt; the result is flagged `grounding:insufficient`.

## Quality concepts

- **Verification** — Council's independent check on AI output (a separate party,
  because a model cannot verify itself). Reduces error and surfaces disagreement;
  does **not** guarantee correctness; **advisory**, never an auto-trust merge gate.
  See [Verification](./verification.md).
- **Confidence vs correctness** — agreement raises **confidence** (a correlation
  signal), **not correctness**. Kept separate by design. See
  [Confidence](./confidence.md).
- **Recall / precision** — of issues that exist, how many were caught (recall); of
  issues flagged, how many were real (precision). A council raises recall at a
  precision cost. See [Recall vs Precision](./recall-vs-precision.md).
- **Bias (self-preference)** — a model rating its own output higher; removed by an
  independent judge. **Bias (shared training-data)** — a blind spot models inherit
  in common; a council **cannot** fix it (grounding can). See [Bias](./bias.md).

## Failure modes

See [Failure Modes](./failure-modes.md).

- **Lossy synthesis** — the judge drops a real finding a proposer caught; the merge
  can under-perform its best member.
- **Shared hallucination / correlated failure** — proposers fail together on a
  blind spot they share; they agree and are wrong.
- **False consensus** — treating agreement as proof; agreement is correlation, not
  truth.
- **No net uplift** — the validated SWE-bench finding: a council showed **no
  measurable net uplift in catch rate** over re-running a single agent. Stated as
  "no net uplift," **never** "catches no more bugs." See
  [Benchmark Methodology](./benchmark-methodology.md).

## Operational terms

- **`request_id`** — the stable id of a consensus call (in the billing line and
  `x_council.request_id`); the handle for rating and tracing. See
  [Auditability](./auditability.md).
- **Auditability** — the trail of who answered, who judged, on what panel, at what
  cost; *traceable and rateable*, not *bit-reproducible*. See
  [Auditability](./auditability.md).
- **Charged credits** (`x_council.charged_credits`) — the real total cost of a call
  (proposers + judge).
- **Routing** — selecting *which* models and *where* they run. Council **consumes**
  routing (panel selection + EU residency); the Router component **owns** provider
  selection and failover. See [Routing](./routing.md).
- **EU residency / `hosting_region`** — region filtering for GDPR-strict decisions
  (`eu` matches `eu` or `fr`); route personal-data prompts to an EU council. See
  [Routing](./routing.md).
- **Dormant** — a built-but-server-gated capability that returns a clear
  "not enabled" / `404` until the platform turns it on (e.g. `tokonomix_upload`,
  `tokonomix_rate_consensus`).

## The tools (all prefixed `tokonomix_`)

| Tool | One line |
|---|---|
| `tokonomix_consensus_ask` | The core: 2–6 proposers + independent judge → one result (by mode). |
| `tokonomix_single_ask` | Single-model passthrough — cheap, for routine calls. |
| `tokonomix_list_models` | Live catalog, filterable by region, provider, tier, capability, origin. |
| `tokonomix_get_balance` | Credit balance and account tier. |
| `tokonomix_rate_consensus` | Rate a call by `request_id` *(dormant: 404 until the feedback-loop is enabled)*. |
| `tokonomix_upload` | Stage large context for grounding *(dormant: "not enabled")*. |
| `tokonomix_onboard` / `tokonomix_onboard_verify` | Keyless first-run onboarding (email + OTP). |
| `tokonomix_get_skill` / `tokonomix_skill_version` | Fetch / fingerprint the usage skill. |

---

### See also

- [The Decision Engineering Manifesto](./decision-engineering-manifesto.md) — the full argument.
- [Tutorial: Your First Consensus Call](./tutorial-getting-started.md) — hands-on.
- [README](../README.md) — the field guide and install.
