# Recall vs Precision

> Part of the [Council MCP](../README.md) documentation suite. This is the cost
> side of consensus, stated in plain terms. A council buys **recall** and pays for
> it in **precision** — knowing whether that trade is worth it for a given decision
> is the whole skill.

**30-second version.** Consensus is a **recall amplifier**: with several decorrelated
models you only need *one* to catch the missed edge case for it to surface, so you
catch more of the real issues. The cost is **precision**: more models means more
flags, and some are nitpicks or false positives that a human or agent must triage.
That trade pays for rare, high-cost decisions and is pure overhead for routine work.

---

## 1. The two quantities

- **Recall** — of the issues that *exist*, how many did you catch? A council raises
  recall because blind spots are decorrelated: the bug only one model would notice
  still gets raised.
- **Precision** — of the issues you *flagged*, how many are real? A council lowers
  precision because every additional model adds flags, and not all of them are real
  — some are nitpicks, some are false positives.

These move in opposite directions. You cannot maximise both at once; you choose
where to sit on the curve based on what a miss costs you versus what triage costs
you.

## 2. Why a council is a recall amplifier

The mechanism is decorrelation, not headcount. One model has one set of blind spots;
a *different-family* model has different ones. Run them in parallel and blind, and an
issue that lives in only one model's strong zone still surfaces — you needed just one
of them to catch it. That is the entire upside: **top-of-panel recall without
needing to know in advance which model is strong for this task.** This is what
[variance-elimination](./decision-theory.md) means in practice.

Note that recall *amplification* is not the same as recall *guarantee*. A shared
blind spot — one every model inherited from common training data — is caught by
*none* of them. The amplifier works on **independent** misses, not shared ones (see
[Bias](./bias.md) and [Failure Modes](./failure-modes.md)).

## 3. The precision cost is real

Every extra flag is work. A five-model panel that each raises one nitpick hands you
five things to adjudicate, most of which a single strong model would not have
bothered you with. For a security review where a missed leak is catastrophic, paying
to triage five flags to catch one real one is an easy trade. For a routine
refactor, it is friction with no payoff.

This is also why "more models" is not a free improvement. Past a small panel,
decorrelation runs out: additional same-family models add flags (precision cost)
without adding coverage (recall benefit). See [Failure Modes
§4](./failure-modes.md#4-specialist--proposer-overlap--diminishing-and-negative-returns).

## 4. When the trade is worth it

**Spend recall (use a council) when:**

- a missed error is **expensive and asymmetric** — the cost of the false negative
  dwarfs the cost of triaging false positives (security, migrations, legal/
  compliance, customer-facing claims);
- the question is genuinely contestable, so the extra flags carry real signal;
- you can [ground](./grounding.md) it on the real artifact.

**Protect precision (use a single model) when:**

- the task is routine and a strong single model already saturates it — our
  benchmark shows the council **ties** the best single model on clean accuracy and
  beats it in no domain (see [Benchmark Methodology](./benchmark-methodology.md));
- triage capacity is the bottleneck and false positives are costly to chase;
- latency or per-call cost dominates.

## 5. The honest bottom line

A council does **not** make you "more accurate" and does **not** "catch more bugs"
as a blanket claim — our SWE-bench run showed **no measurable net uplift in catch
rate** once false positives were netted out (see [Failure
Modes](./failure-modes.md#7-our-load-bearing-negative-finding)). What it gives you
is a **tunable recall/precision trade** plus variance-elimination: a way to spend
extra model calls to raise recall on the decisions where a miss is expensive — and
the discipline to *not* spend them where it is not.

---

### See also

- [Consensus](./consensus.md) — picking the mode for how much spread you want.
- [Failure Modes](./failure-modes.md) — the precision cost and shared blind spots.
- [Decision Theory](./decision-theory.md) — variance-elimination.
- [Benchmark Methodology](./benchmark-methodology.md) — the measured trade.
- [Routing](./routing.md) — sizing and selecting the panel.
