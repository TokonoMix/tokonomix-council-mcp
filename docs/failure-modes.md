# Failure Modes

> Part of the [Council MCP](../README.md) documentation suite. This is the honest
> centrepiece. **A decision tool that hides its failure modes is not a decision
> tool — it is marketing.** Every limitation below is named because naming them is
> the point, not a disclaimer.

**30-second version.** Consensus is not free and not always a win. It can drop a
real finding in synthesis, it can agree confidently and be wrong, it costs
precision and latency, and on routine tasks it is no better than a single model.
Read this before you rely on a council; knowing *when consensus is worse* is the
skill that makes it useful.

![Four named failure modes of consensus: lossy synthesis (the merge under-performs its best member), shared hallucination (models fail together on a common blind spot), false consensus (agreement is correlation not truth), and precision cost (more flags to triage); on saturated tasks a single model can be better.](./diagrams/failure-modes.svg)

---

## 1. Lossy synthesis — the council can lose what a member caught

When the judge merges several answers into one, it can **drop a real finding** that
a single proposer correctly raised. The synthesized decision can therefore be
*weaker* than the best individual answer in the panel — the council under-performs
its own best member.

We have observed this directly: in our 5-domain benchmark the winning proposer
*shifts* by domain, and the merged consensus does not always carry that winner's
catch through. The mitigation is to use a mode that preserves the spread when the
spread matters: [`full`](./consensus.md#2-pick-the-mode-by-intent) (answers plus
the judge's per-model reasoning) or `raw` (every answer, no judge) instead of
`consensus`, so a dropped finding is still visible to you.

## 2. Correlated failures and shared hallucinations

The entire value of a council depends on **decorrelation** — different models with
different blind spots. But frontier models **share training data**. When their
blind spots overlap, they fail *together*: every proposer misses the same edge
case, or every proposer hallucinates the same non-existent API, and they do so
**confidently**.

A council cannot detect a blind spot that all its members share. Adding more models
from the same era and lineage does not help here — it can make the false agreement
look *more* authoritative. The real mitigation is **[grounding](./grounding.md)**
(reason over the real artifact, not shared memory) and cross-family
[judge independence](./judge-independence.md) — not headcount.

## 3. False consensus — agreement is not correctness

It is tempting to read "all the models agreed" as "the answer is right." It is not.
**Agreement is a measure of correlation, not of truth.** Ungrounded consensus can
launder a shared hallucination into a high-confidence wrong answer — the worst kind
of error, because it *feels* validated.

This is why Council never auto-trusts a consensus result as a merge gate, and why
[confidence is kept separate from correctness](./verification.md). A unanimous
council on an ungrounded question should *lower* your guard, not raise it.

## 4. Specialist / proposer overlap — diminishing and negative returns

More proposers is not monotonically better. Two proposers that share a blind spot
add **cost and false-positive flags without adding recall** — you pay for a second
opinion and get an echo. Past a small panel, decorrelation runs out and you are
buying nitpicks. Council selects for **decorrelation over raw score** precisely to
spend the proposer budget on coverage, not on redundancy. (See
[Routing](./routing.md) for selection; [Recall vs Precision](./recall-vs-precision.md)
for the cost curve.)

## 5. The precision cost — more flags, more adjudication

Consensus raises recall by raising the number of flags. Some of those flags are
nitpicks or outright false positives. **Every extra flag is work** for the human or
agent who must adjudicate it. For a high-asymmetric-cost decision that work is worth
it; for routine work it is pure overhead. If you cannot afford to triage false
positives, consensus is the wrong tool for that task.

## 6. When consensus is *worse* than a single model

Be concrete about it. Use a single model
([`tokonomix_single_ask`](../README.md#tools)), not a council, when:

- **The task is routine and a strong single model already saturates it.** Our
  5-domain benchmark shows the council **ties** the best single model on clean
  accuracy and beats it in **no** domain. On saturated tasks consensus only adds
  cost and latency.
- **Latency or cost dominates.** A council is several model calls plus a judge call;
  a single model is one. For high-volume or interactive paths the trade rarely pays.
- **There is nothing real to ground on.** An ungrounded council on an artefact-less
  question buys correlated guessing, not decision quality.

## 7. Our load-bearing negative finding

We publish this because honesty is the competitive advantage:

> A round-2 validation on SWE-bench-Verified defect tasks (N=29) **falsified** the
> "consensus catches more bugs" hypothesis. A non-Anthropic baseline (GPT-4o)
> missed 29 of 30 real bugs; running a cross-family council on those 29 produced
> **no measurable net uplift in catch rate** over simply re-running the agent — the
> council occasionally caught a miss, but false-positive flags netted it out
> (effect +0.12, with a confidence interval crossing zero).

The precise, honest claim is therefore **"no net uplift"** — *not* "catches no more
bugs," which would over-claim in the other direction. We do not, anywhere, claim the
council is "more accurate" or "catches more bugs." (Full method: [Benchmark
Methodology](./benchmark-methodology.md).)

## 8. What this means for how you use it

None of the above makes consensus useless — it makes it **specific.** Council is a
recall amplifier that **feeds judgement; it does not replace it.** It is:

- **advisory, never an auto-trust merge gate** — a verdict informs a decision, it
  does not authorise an irreversible action on its own;
- best on **rare, high-asymmetric-cost, groundable** decisions;
- worth its precision cost only when a missed error is expensive.

The honest summary of what it buys is unchanged: **variance-elimination,** a
**verification / QA layer,** **judge-independence,** **EU data residency,** and
**grounding** — *not* "more accurate."

---

### See also

- [Consensus](./consensus.md) — when consensus helps, and the modes by intent.
- [Grounding](./grounding.md) — the strongest mitigation for shared hallucination.
- [Recall vs Precision](./recall-vs-precision.md) — the cost side of the trade.
- [Verification & Confidence](./verification.md) — confidence ≠ correctness.
- [Benchmark Methodology](./benchmark-methodology.md) — the reproducible findings.
