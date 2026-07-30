# Consensus

> Part of the [Council MCP](../README.md) documentation suite. Council owns the
> **decision**; consensus is one of its mechanisms, not its purpose. For why the
> decision is the unit of value, see [Decision Theory](./decision-theory.md).

**30-second version.** Consensus is the mechanism where several independent models
answer the *same* question in parallel and blind, and an independent judge
reconciles their answers into one. It is a **recall amplifier**: with several
decorrelated models you only need *one* to catch the missed edge case for it to
surface. Use it when the cost of a missed error is high; skip it for routine work.
Consensus is a **means** to a better decision — not the goal, and not a guarantee
of correctness.

![The five synthesis modes after the proposer fan-out: consensus (one decided answer, default), diff (agree/disagree map, judge compares not decides), raw (all answers, no judge), best_of (single strongest), full (all answers plus judge reasoning and a conclusion).](./diagrams/consensus-flow.svg)

---

## 1. How a council runs

When you call [`tokonomix_consensus_ask`](../README.md#tools):

1. **Fan-out.** Your prompt goes to 2–6 proposer models **in parallel and blind** —
   no proposer sees another's answer. Blindness is deliberate: it preserves dissent.
   Models that can see each other tend to capitulate to the most fluent answer,
   which destroys the very disagreement you are paying for.
2. **Judge.** An **independent judge** — disjoint from the proposers, cross-family,
   never scoring its own answer — reconciles the proposers' answers. The default
   judge is Claude Haiku; you can override it with `judge_model` or `judge_models`.
   (Why disjoint: [Judge Independence](./judge-independence.md).)
3. **Grounding.** If you attach the real artifact via `context.inline` (or
   `github_refs`), every proposer **and** the judge reason over the same source
   instead of guessing. This is the strongest single lever on decision quality —
   see [Grounding](./grounding.md).

The result carries the synthesis plus metadata you can audit and rate (request id,
which proposers ran, which errored). See [Auditability](./auditability.md).

## 2. Pick the mode by intent

There is **no universally best mode.** `tokonomix_consensus_ask` takes a `mode`
parameter; choose it by what you need *out* of the call:

| Mode | What it returns | Use when |
|---|---|---|
| `consensus` *(default)* | One merged, **decided** answer | You want *the* answer; you accept that dissent is traded away. |
| `diff` | An agreements / disagreements / confidence map — the judge **COMPARES, it does NOT decide** | You will adjudicate yourself but want the disagreement mapped for you. |
| `raw` | Every answer verbatim, **no judge** (cheapest) | You want the unfiltered spread and will decide entirely yourself. |
| `best_of` | The judge picks the single **strongest** verbatim answer | You want one model's answer, chosen on merit, not a merge. |
| `full` | Every answer **plus** the judge's per-model reasoning **and** a conclusion (one judge pass, not an extra call) | You want both the raw landscape and a verdict. |

> **`diff` does not decide.** A common mistake is to read a `diff` result as a
> verdict. It is a *map* of where the models agree and disagree; the decision is
> still yours. If you want the council to decide, use `consensus`.

## 3. When consensus helps — and when it does not

Consensus is a recall/precision trade. It raises recall (more decorrelated eyes
catch more) at the cost of precision (more models means more flags, some of them
nitpicks a human or agent must adjudicate). That trade is worth paying for *rare,
high-asymmetric-cost* decisions and **not** for routine work.

**It helps when:**

- the cost of a missed error is high and asymmetric (security review, a schema or
  migration direction, a legal/compliance statement, a customer-facing claim);
- the question is genuinely contestable, so disagreement is real information;
- you can **ground** it on the real artifact.

**It does not help (use [`tokonomix_single_ask`](../README.md#tools)) when:**

- the task is routine and a strong single model already saturates it — our
  5-domain benchmark shows the council *ties* the best single model on clean
  accuracy and beats it in no domain (see [Benchmark
  Methodology](./benchmark-methodology.md));
- latency or cost matters more than catching a rare miss;
- you have nothing real to ground on (an artefact-less general question).

**It can hurt when** you treat agreement as proof. Frontier models share training
data and can be uniformly, confidently wrong on a shared blind spot. Consensus
that is ungrounded does not fix a shared hallucination — it can launder it into
false confidence. The honest mitigation is grounding, not more models. See
[Failure Modes](./failure-modes.md).

## 4. The validated limit (stated plainly)

We publish our negative findings because honesty is the point, not a disclaimer:

- On a SWE-bench-Verified defect run, a cross-family council produced **no
  measurable net uplift in catch rate** over simply re-running a single agent —
  the council occasionally caught a miss, but false-positive flags netted it out.
  The precise claim is **"no net uplift"** — *not* "catches no more bugs", which
  would over-claim in the other direction.
- On a 5-domain accuracy benchmark, the council **tied** the best single model and
  beat it in **no** domain.

So Council does **not** claim "more accurate" or "catches more bugs" anywhere.
What it buys is **variance-elimination, a verification/QA layer,
judge-independence, EU data residency, and grounding.** Read
[Recall vs Precision](./recall-vs-precision.md) and [Benchmark
Methodology](./benchmark-methodology.md) before you rely on it.

---

### See also

- [Decision Theory](./decision-theory.md) — why one model is one perspective.
- [Judge Independence](./judge-independence.md) — the disjoint, cross-family judge.
- [Grounding](./grounding.md) — the strongest lever on decision quality.
- [Failure Modes](./failure-modes.md) — how consensus can mislead.
- [Routing](./routing.md) — EU-default routing and model selection.
