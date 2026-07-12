# Benchmark Methodology

> Part of the [Council MCP](../README.md) documentation suite. The point of this doc
> is **reproducibility over flattery.** We publish our negative findings — including
> the one that falsified our own hypothesis — because honesty is the competitive
> advantage, not a disclaimer.

**30-second version.** We measure decision quality with reproducible methodology:
fixed datasets, fixed metrics, outcome-based scoring. The headline result is
honest and negative — on a SWE-bench-Verified defect set the council showed **no
measurable net uplift in catch rate**, and on a 5-domain accuracy benchmark it
**tied** the best single model and beat it in **no** domain. So we claim
**variance-elimination, not "more accurate"** — and we show our work.

---

## 1. What we measure, and why it is hard

Benchmarking a *decision process* is not the same as benchmarking a model. A model
benchmark asks "how often is the answer right?" A decision benchmark has to separate
two things a single number conflates:

- **Recall** — of the issues that exist, how many were caught?
- **Precision** — of the issues flagged, how many were real?

A process can raise recall while lowering precision (more eyes catch more, but also
flag more nitpicks). Reporting only one hides the trade. We report the trade. (See
[Recall vs Precision](./recall-vs-precision.md).)

We also separate **Performance = Model × Harness**: how a decision is *delivered*
(the panel, the judge, grounding) is a variable, not a constant. A finding is only
meaningful when the harness is held fixed and stated.

## 2. Methodology principles

- **Fixed, external datasets.** Prefer established, externally-sourced sets (e.g.
  SWE-bench-Verified) over hand-picked examples, so results are checkable by others.
- **Outcome-based scoring.** Score against ground truth (the known bug, the known
  answer), not against a model's self-report or another model's opinion.
- **Held-fixed harness.** State the panel, the judge, the modes, and the grounding;
  vary one thing at a time.
- **Pre-registered claims.** Decide what would *falsify* the hypothesis before
  running, so a null result is a finding and not a thing to bury.
- **Reproducible at the methodology level.** LLMs are non-deterministic, so a single
  call does not replay bit-for-bit (see [Auditability](./auditability.md)). What
  reproduces is the *method*: same datasets, same metrics, same harness → same
  qualitative result.
- **No fabricated numbers.** We cite only figures we measured. Where a past
  experiment was not reproducible, we drop it rather than quote it.

## 3. Findings

### 3.1 SWE-bench-Verified defect detection — the falsified hypothesis

We pre-registered the hypothesis "a cross-family council catches more real bugs than
re-running a single agent" and set out to falsify it.

- A non-Anthropic baseline (GPT-4o) was run on a defect set and **missed 29 of 30**
  real bugs.
- A cross-family **council** was then run on those **29** missed cases.
- Result: **no measurable net uplift in catch rate.** The council occasionally
  caught a miss, but false-positive flags netted it out — measured effect **+0.12**
  with a **confidence interval crossing zero**.

The precise claim is therefore **"no net uplift"** — *not* "catches no more bugs,"
which would over-claim a null result in the other direction. (Our own consensus
review flagged that overreach; we corrected it.) We do **not**, anywhere, claim the
council catches more bugs.

### 3.2 Five-domain accuracy — a tie, not a win

Across a 5-domain accuracy benchmark, the council **tied** the best single model on
clean accuracy and **beat it in no domain.** Two structural observations:

- **The winner shifts by domain.** No single model is best everywhere — which is
  exactly the case for variance-elimination (you stop having to guess which model is
  strong for *this* task) and exactly *not* a case for "more accurate."
- **Lossy synthesis is real.** The merged consensus can drop a finding its best
  member caught, so it can under-perform that member (see [Failure
  Modes](./failure-modes.md#1-lossy-synthesis--the-council-can-lose-what-a-member-caught)).

Several of the clean datasets **saturated** — a strong single model already maxed
them out, leaving no headroom for a council to demonstrate a gain. That is itself a
finding: on saturated tasks, consensus adds cost without adding decision quality. It
also motivates harder, less-saturated test protocols for future runs.

## 4. What the numbers do and do not support

**Supported by the data:**

- **Variance-elimination** — you get top-of-panel results without needing to pick
  the right model in advance.
- **A verification / QA layer, judge-independence, grounding, EU residency** — design
  properties, not accuracy claims.

**Not supported (and not claimed):**

- "More accurate" — the council tied, it did not win.
- "Catches more bugs" — the catch-uplift hypothesis was falsified (no net uplift).
- Any benchmark we could not reproduce — deliberately excluded.

## 4b. Statistical power & data availability (read before citing the numbers)

Being honest about the *conclusion* also means being honest about the *strength of
the evidence* behind it:

- **The SWE-bench-Verified run is underpowered.** It is **N = 29** binary trials with
  a council effect of **+0.12 whose confidence interval crosses zero**. That is enough
  to *falsify* a large "catches many more bugs" claim (which is why we dropped it), but
  **not** enough to establish any effect in either direction. Treat this figure as
  **indicative, not conclusive** — a bigger, pre-registered run is needed to say more,
  and until then we do not lean on it beyond "no measurable net uplift."
- **The 5-domain accuracy benchmark is reported as a summary, not yet as data.** The
  "tie, wins nowhere, several datasets saturated" conclusion is what we observed; the
  **per-domain numbers, model list, and metric tables are not published here yet.** So
  "tie" is our reported result, not something you can currently re-derive from this doc.
- **The harness and per-case results (including the negatives) are being prepared for
  publication.** Until that lands, everything above is our *stated* finding, not a
  *reproducible artifact* — the reasoning is on the page, the raw work is not. We would
  rather say that plainly than imply more rigor than we have shipped. When the datasets
  and harness are public, this section will link them directly.

## 5. Reproducing or extending this

To reproduce a finding: fix the dataset and the harness (panel, judge, modes,
grounding), score against ground truth, and report **both** recall and precision
with the effect size and its confidence interval. To extend it: prefer
less-saturated, externally-sourced datasets so there is headroom to detect a real
effect, and pre-register what would falsify the claim. Report null results. The
goal is a decision tool you can *trust*, which requires evidence you can *check*.

---

### See also

- [Failure Modes](./failure-modes.md) — the limits these findings name.
- [Recall vs Precision](./recall-vs-precision.md) — the trade we measure.
- [Confidence](./confidence.md) — agreement is not correctness.
- [Auditability](./auditability.md) — reproducibility at the right level.
- [The Decision Engineering Manifesto](./decision-engineering-manifesto.md) — the full argument.
