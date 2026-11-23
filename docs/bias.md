# Bias

> Part of the [Council MCP](../README.md) documentation suite. Council exists partly
> to counter bias — but it removes some biases and is powerless against others.
> Being clear about which is which is the honest version of this doc.

**30-second version.** Every model carries bias: one training run, one alignment,
one set of blind spots. A council of *decorrelated* models reduces the bias that is
**independent** between models (one model's idiosyncratic mistake). It is powerless
against bias that is **shared** between them (a blind spot inherited from common
training data). The fix for the second kind is [grounding](./grounding.md), not more
models.

---

## 1. Single-model bias

A single model's judgement is a fixed function of its training data, its alignment,
and its decoding. That produces predictable distortions: it over-represents patterns
common in its training corpus, under-notices the rare edge case it rarely saw, and
states both with the same fluent confidence. You cannot tell from one answer whether
you are seeing knowledge or a confident gap.

A council helps here because the distortions are **independent across families**:
the edge case one model missed, a decorrelated model may catch. This is the bias
Council is good at — idiosyncratic, per-model error. Surfacing it is what
[variance-elimination](./decision-theory.md) means.

## 2. Self-preference bias

Models systematically rate **their own** outputs higher than others'. If the model
that judges is also one of the proposers, the "decision" drifts toward its own
answer and the panel collapses back to one opinion. Council removes this by keeping
the [judge independent](./judge-independence.md): disjoint from the proposers,
cross-family, never scoring its own answer. This is a bias Council removes *by
construction*.

## 3. Shared training-data bias — the one a council cannot fix

This is the honest limit. Frontier models are trained on overlapping data from the
same era. They therefore share blind spots: the same outdated fact, the same
hallucinated API, the same missed class of bug. When the bias is **shared**, the
models **agree** — and a council reads agreement as a strong signal, so shared bias
becomes *false confidence* rather than getting caught. (See [Failure
Modes](./failure-modes.md#2-correlated-failures-and-shared-hallucinations) and
[Confidence](./confidence.md).)

Adding more same-era models does **not** mitigate shared bias — it can entrench it.
The mitigations that work are:

- **Grounding** — reason over the real artifact, so a shared *memory* error is
  checked against reality. This is the strongest lever (see [Grounding](./grounding.md)).
- **Decorrelation** — select proposers and judge for *different* lineages, not for
  the highest leaderboard score, so blind spots overlap less.
- **EU / origin-aware routing** — when sovereignty matters, route to models from
  different origins (`hosting_region`, `origin_country` on
  [`tokonomix_list_models`](../README.md#tools)); see [Routing](./routing.md).

## 4. What this means in practice

| Bias type | Independent across models? | Does a council help? |
|---|---|---|
| Idiosyncratic single-model error | Yes | **Yes** — decorrelated panel catches it |
| Self-preference of a judge | Removable | **Yes** — independent judge removes it |
| Shared training-data blind spot | No | **No** — needs grounding, not more models |

The takeaway is the same as everywhere else in this suite: the council is a recall
amplifier that feeds judgement. It corrects the bias that varies between models and
is honest that it cannot correct the bias they share — which is why grounding, not
headcount, is the headline lever.

---

### See also

- [Decision Theory](./decision-theory.md) — independence and variance-elimination.
- [Judge Independence](./judge-independence.md) — removing self-preference.
- [Grounding](./grounding.md) — the fix for shared bias.
- [Confidence](./confidence.md) — why shared bias reads as false confidence.
- [Routing](./routing.md) — decorrelation and sovereignty-aware selection.
