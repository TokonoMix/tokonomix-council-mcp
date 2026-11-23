# Confidence

> Part of the [Council MCP](../README.md) documentation suite. The most important
> sentence here: **agreement raises confidence, not correctness.** Keeping those two
> apart is a design principle, not a footnote.

**30-second version.** When independent models agree, it is tempting to treat that
as proof. It is not. Agreement measures **correlation**, and frontier models share
training data, so they can agree and be wrong together. Council surfaces how much
the models agreed so you can *calibrate* your trust — but a unanimous *ungrounded*
council should lower your guard, not raise it. Confidence is a signal to weigh, not
a verdict to obey.

![Agreement raises confidence, not correctness: agreement on an ungrounded question is the least trustworthy state, disagreement is real signal that a question is contestable, and grounded agreement is safest; confidence is calibration input, never an authorisation to act.](./diagrams/confidence.svg)

---

## 1. Agreement ≠ truth

A council that agrees has told you one thing for certain: the models **correlated**
on this answer. It has *not* told you the answer is correct. Correlation and
correctness are different quantities, and on shared training data they come apart
exactly where it hurts most — a blind spot every model inherited produces unanimous,
confident, wrong output. (See [Failure Modes
§2–§3](./failure-modes.md#2-correlated-failures-and-shared-hallucinations).)

So Council does not convert agreement into a correctness claim. It reports the
*shape* of the answer — agreement, disagreement, the spread — and leaves the
correctness judgement where it belongs: with the human or agent who can ground it.

## 2. Confidence as calibration, not as a gate

The useful way to read a consensus result is as **calibration input**:

- **Strong, grounded agreement** → reasonable to proceed, still your decision.
- **Disagreement** → real information that the question is contestable; slow down,
  look at the dissent (use [`diff`](./consensus.md#2-pick-the-mode-by-intent) or
  `full` to see it).
- **Strong agreement, but ungrounded** → the *least* trustworthy combination: high
  apparent confidence with nothing real underneath it. Attach the
  [artifact](./grounding.md) before you rely on it.

Confidence never authorises an irreversible action by itself. Council is
[advisory](./verification.md); the [decision lifecycle](./auditability.md) keeps the
human accountable.

## 3. Separate confidence from correctness — by design

This is one of the design principles of Decision Engineering: **separate confidence
from correctness.** A decision process that fuses them — "the models were confident,
therefore ship it" — manufactures exactly the false certainty it was supposed to
prevent. Council keeps them separate:

- It preserves dissent (parallel + blind proposers) so disagreement is not smoothed
  into false confidence.
- Its judge is independent, so confidence is not inflated by
  [self-preference](./bias.md).
- It treats grounding as the lever that earns confidence, not headcount.

## 4. Confidence does not improve with more models

Adding models does not make a council *more right* — our benchmarks show a tie with
the best single model on clean accuracy and no net catch uplift on defects (see
[Benchmark Methodology](./benchmark-methodology.md)). What more *decorrelated*
models buy is **variance-elimination**: you stop gambling on which single model you
happened to ask. That is a real benefit, and it is different from "more confident →
more correct." Do not read variance-elimination as an accuracy claim.

---

### See also

- [Verification](./verification.md) — what is and is not checked.
- [Bias](./bias.md) — why agreement is correlated, not independent, evidence.
- [Grounding](./grounding.md) — the lever that actually earns confidence.
- [Failure Modes](./failure-modes.md) — false consensus in detail.
- [Recall vs Precision](./recall-vs-precision.md) — the cost of more flags.
