# tokonomix-council-mcp

[![npm version](https://img.shields.io/npm/v/tokonomix-council-mcp.svg)](https://www.npmjs.com/package/tokonomix-council-mcp)
[![license](https://img.shields.io/npm/l/tokonomix-council-mcp.svg)](./LICENSE)
[![node](https://img.shields.io/node/v/tokonomix-council-mcp.svg)](https://nodejs.org)
[![MCP Registry](https://img.shields.io/badge/MCP%20Registry-.well--known%2Fmcp-blue)](https://tokonomix.ai/.well-known/mcp/server.json)

**A multi-model consensus MCP server** — cross-vendor proposers, an independent judge, and blind-spot/disagreement detection for high-stakes AI decisions. An open reference implementation of AI Decision Engineering — a discipline we are proposing, not yet an external standard.

> **Mission.** *Help autonomous systems make better decisions by combining independent expert reasoning instead of trusting a single model.*

> **In 20 seconds:** *Important AI decisions deserve more than one opinion.*

### The Tokonomix ecosystem (where Council fits)

Council is one specialized component in a larger stack. Each owns exactly one responsibility, so they compose cleanly:

```
   Execution    →  ANS         (run a backlog to completion, unattended)
   Decision     →  Council     (independent review → grounded decision)   ◀── this repo
   Verification →  Media QC    (image / video / document output quality)
   Measurement  →  Benchmark   (intelligence tests, arena, reputation)
   Routing      →  Router      (which provider/model hosts a call)
   Memory       →  Memory      (durable context across sessions)
   Safety       →  Safety      (policy / guardrail enforcement)
```

**Council owns one box: the decision.** It does not execute, schedule, route, or remember — those live in their own components ([details below](#council-in-the-tokonomix-ecosystem)).

---

Council MCP exists to improve **decision quality**, not to chat, generate, or route. The governing idea is simple:

> ### Consensus × Ground Truth = Decision Quality

Consensus is **one** mechanism for decision quality — not the whole of it. **Grounding** (checking a claim against the real artifact) is the strongest lever, stronger than adding more models; **judge-independence** and **verification** are mechanisms too. Several independent expert models assess the same problem in parallel and blind, an **independent, cross-family judge** reconciles their findings, and grounding ties the whole thing to reality — so you get one decision you can act on, with the disagreements a single model would have hidden surfaced rather than smoothed away. **Consensus is a *means*; better decisions are the goal.**

It is **not** a chatbot, a model, an LLM, a prompt library, a multi-model chat, a voting system, or an averaging system. It does not make any model smarter, and it does not pick a winner by majority — it changes how multiple independent models' outputs become *one defensible decision*.

> **What it honestly buys you — and what it does not.** Across our own validation (see [Benchmarks](#benchmarks)), the council **ties the best single model on clean accuracy and beats it nowhere**, and on a SWE-bench bug-detection run it showed **no measurable net uplift in catch rate** over re-running a single agent. So we do **not** claim "more accurate" or "catches more bugs" anywhere. What it does buy is **variance-elimination** (you stop gambling on which single model you happened to ask), a **verification / agent-QA layer**, **judge-independence**, **EU data residency**, and **grounding**. Read [When consensus helps / doesn't / can hurt](#when-consensus-helps--doesnt--can-hurt) before you rely on it — that section is the point, not a disclaimer.

Works with **Claude Code, Cursor, Cline, Continue, and Zed**. One `npx` line to install.

> ### Principles of Decision Engineering
>
> The discipline Council implements rests on ten principles. An autonomous system should:
>
> 1. **Verify before acting** — a decision is provisional until it has been checked.
> 2. **Preserve disagreement** — the lone dissent is often the finding that mattered; never average it away.
> 3. **Separate execution from judgement** — the thing that *does* the work should not also be the thing that *grades* it.
> 4. **Separate reasoning from verification** — generating an answer and checking it are different jobs.
> 5. **Separate confidence from correctness** — a model's tone is identical whether it is right or wrong.
> 6. **Prefer evidence over agreement** — agreement measures agreement, not truth; ground the claim.
> 7. **Expose uncertainty** — surface what was *not* settled, don't hide it behind one confident answer.
> 8. **Make decisions auditable** — record who proposed, who judged, what it cost, on what input.
> 9. **Remain reproducible** — the same input and method should be re-runnable to the same finding.
> 10. **Never hide failure modes** — a decision tool that conceals when it fails is not a decision tool.

---

## What Council owns — and what it explicitly does not

Council is a **Decision Engineering layer**. Its scope is deliberately narrow, because a clear boundary is what makes a component trustworthy to compose with.

**Council owns DECISIONS ONLY:**

- decision quality and decision confidence,
- independent review and reasoned consensus,
- verification of reasoning and claims,
- grounding (checking a claim against the real artifact),
- disagreement analysis,
- judge independence,
- auditability of how a decision was reached.

**Council is explicitly NOT responsible for:** execution, workflow, task scheduling, agent autonomy, long-term memory, provider routing, or browser automation. Those are real responsibilities — they simply live in **other** components.

- Need something **executed** (a backlog run to completion, unattended)? That is **[Agents Never Sleep (ANS)](https://github.com/TokonoMix/agents-never-sleep)**, the execution governor. ANS is the worker/governor; Council is the verifier it can delegate a decision to. Council does not run, schedule, or remember work.

See [Council in the Tokonomix ecosystem](#council-in-the-tokonomix-ecosystem) for where every adjacent responsibility lives.

---

## Why Council exists (the short story — for a human OR an AI agent)

**Why does Council exist?** Because important AI decisions are made by single models that answer with total confidence and never tell you what they didn't consider. For chat that is fine; for a security review, a migration, a GDPR interpretation, or a legal clause, a confidently-wrong decision is expensive and you find out too late.

**Why is one model not enough?** A single model is one opinion with one blind spot. *Which* model is strongest is not stable — it shifts per task, per domain, per bug class. Standardise on the wrong one and you ship real defects without ever seeing a disagreement.

**When does combining models help?** When errors are *uncorrelated*: different vendors are wrong about different things, so you only need one of them to catch the timing side-channel or the missed edge case for it to surface. That decorrelation only exists **across** vendors — a single vendor's "panel" shares its own training data and blind spots.

**When does it NOT help?** On routine work (renames, formatting, lookups) and on easy tasks any strong single model already saturates. There the council only adds cost and noise — use a single model.

**Why does grounding matter more than more models?** Because agreement measures agreement, not truth. Ungrounded, frontier models can agree *and be uniformly wrong* (they share training data). Feeding the council the real artifact — the literal file, diff, spec, logs — is the lever that turns "they agreed" into "they checked it against reality." More models cannot fix a shared blind spot; grounding can.

**Why does judge independence matter?** Because a judge that also wrote one of the answers scores its own work and *inflates* agreement (LLM self-preference is real and measured). A disjoint, cross-family judge is the only honest reconciler.

**Why do failure modes matter?** Because consensus *can* be worse than a single model — lossy synthesis, correlated failures, false consensus, specialist overlap. A decision tool that hides its failure modes is not a decision tool. **Honesty about when consensus does NOT work is the competitive advantage**, not a caveat we bury.

---

## Contents

1. [Why Decision Engineering is becoming necessary](#why-decision-engineering-is-becoming-necessary)
2. [Why LLMs cannot solve this themselves](#why-llms-cannot-solve-this-themselves)
3. [Design principles](#design-principles)
4. [A story: the security review](#a-story-the-security-review)
5. [The problem](#the-problem)
6. [Why single-model review falls short](#why-single-model-review-falls-short)
7. [How Council works](#how-council-works)
8. [Architecture](#architecture)
9. [The consensus process](#the-consensus-process)
10. [The judge](#the-judge)
11. [When consensus helps / doesn't / can hurt](#when-consensus-helps--doesnt--can-hurt)
12. [Decision Engineering vs existing techniques](#decision-engineering-vs-existing-techniques)
13. [Council in the Tokonomix ecosystem](#council-in-the-tokonomix-ecosystem)
14. [Practical examples](#practical-examples)
15. [Installation](#installation)
16. [Integration & API surfaces](#integration--api-surfaces)
17. [Benchmarks](#benchmarks)
18. [Glossary](#glossary)
19. [FAQ](#faq)
20. [Roadmap](#roadmap)

> **Going deeper:** this README is the field guide. The full argument — why the field exists, the design principles, the failure modes, why one model is insufficient, why consensus *alone* is insufficient, why grounding is necessary, and why a human stays ultimately accountable — lives in the **[Decision Engineering Manifesto](docs/decision-engineering-manifesto.md)**. The README links out rather than duplicating that depth.

---

## Why Decision Engineering is becoming necessary

Every time software took on more responsibility, a new discipline appeared to keep it trustworthy — not because engineers got worse, but because the cost of an unchecked output got higher:

| Software gained… | …so we invented |
|---|---|
| Code that ran unattended | **Testing** — prove it does what we think |
| Many people committing | **Continuous Integration** — catch breakage on every change |
| Code too large to hold in one head | **Code Review** — a second pair of eyes before merge |
| Subtle, repeating defect classes | **Static Analysis** — a machine that flags them automatically |
| Systems shipping continuously | **DevOps** — make deployment itself safe and observable |
| **Models that now make decisions** | **Decision Engineering** — make the *decision* itself reviewable, grounded, and auditable |

The pattern is the same each time: a capability outran our ability to trust it, and we built a discipline to close the gap. LLMs have crossed that line — they no longer just generate text, they *decide*: which migration is safe, whether an auth path is exploitable, how a clause reads under GDPR. A decision made by one confident model, with no independent check and no record of what it didn't consider, is exactly the unchecked output every prior discipline was invented to catch. Decision Engineering is that discipline for the era where models, not only people, make the call.

## Why LLMs cannot solve this themselves

The obvious objection is "models keep getting better — won't a strong enough single model just be right?" It misreads the problem. The issue is not that any given model is weak; it is structural:

**A model cannot independently verify itself.** Asking the same model "are you sure?" runs the same weights over the same training data and the same blind spot — it will defend its first answer with the same confidence, because the thing that produced the error is the thing you are asking to find it. Self-critique inside one model is not an independent check; it is the same mind marking its own exam. This is true of GPT, of Claude, of Gemini, of whatever ships next — not a comment on any of them being weak.

Independence has to come from *outside* the model:

- **A different vendor**, because correlated training data means a single vendor's "panel" shares the same blind spots — its own agreement is not corroboration.
- **A different role** — a judge that did *not* write the answer, so it isn't scoring its own work (LLM self-preference is real and measured).
- **External ground truth** — the literal file, diff, spec, or logs, because a model cannot conjure a fact it never had, and agreement on a shared wrong prior is still wrong.

That is the whole argument for why Decision Engineering is a *layer above* models rather than a better model: the independence and the grounding that make a decision trustworthy are precisely the things one model cannot supply for itself.

## Design principles

Council's engineering follows from the principles above. Each is a constraint we hold ourselves to, not a marketing line:

- **Single Responsibility** — Council decides; it does not execute, schedule, route, or remember. A narrow scope is what makes a component safe to compose.
- **Independence** — proposers answer blind and in parallel; the judge is disjoint from them and cross-family. No model grades its own work.
- **Ground Truth** — claims are checked against the real artifact, not a paraphrase or a shared prior. Grounding outranks panel size.
- **Evidence First** — corroboration must rest on the evidence, not on models happening to agree.
- **Auditability** — every decision returns who proposed, who judged, and what it cost, so it can be reconstructed.
- **Transparency** — what was *not* settled is surfaced (the blind-spots section, the `diff` map), never hidden behind one answer.
- **Reproducibility** — the same input + method re-runs to the same finding; record the models and date, because the default council can change.
- **Traceability** — a `request_id` and a billing breakdown tie a stored decision back to exactly how it was produced.
- **Human Accountability** — Council surfaces and grounds; it does not absolve. A human (or your agent acting for one) remains ultimately responsible for acting on the decision.

## A story: the security review

A team ships an authentication middleware. Before merge, an engineer pastes it into a single strong model — GPT — and asks, "any security issues?" The answer comes back clean: *"No issues found, the implementation looks correct."* One confident opinion, no dissent, nothing flagged. It merges. Three weeks later a token-comparison side-channel — the kind where response timing leaks whether the first byte of a secret matched — is exploited in production. The post-mortem is expensive, and the worst part is that nothing *warned* them: the review said "fine," so they believed it was fine.

Now replay it through Council. The same middleware fans out to several independent vendors, blind and in parallel. Three of them also say "looks fine." But **Claude**, reading the literal source rather than a summary, notices the comparison isn't constant-time and flags a possible timing leak. Because the proposers answered independently, that lone dissent isn't drowned out — and the **independent judge**, instead of papering over the split, *surfaces the disagreement*: "one reviewer flags a non-constant-time token comparison; the others did not address timing." The engineer sees a disagreement on a security-critical path, investigates the one finding that mattered, confirms the leak, and fixes it before merge.

That is the entire difference: not a smarter model, but a process that **preserved the dissent and put it in front of a human** instead of averaging it into a confident "looks fine." The bug was always catchable — it just needed one independent reviewer to see it and a design that wouldn't bury what it found.

---

## The problem

A single LLM is a single point of failure. It answers with total confidence — and, worse, it never tells you what it *didn't* consider. For a chat reply that's fine. For a security review, an architecture decision, a GDPR interpretation, a database migration, or a legal clause, a confidently-wrong answer is expensive, and you find out too late.

The reflex fix — reach for a bigger model — doesn't address the failure: a bigger single model is still *one* opinion, with *one* blind spot, that still won't tell you what it missed. And **which** single model happens to be strong is not stable: it shifts per task, per domain, and per bug class. Standardise on the wrong one and you ship real defects without ever seeing a disagreement.

Council MCP is built for exactly the class of decision where being wrong is asymmetrically costly: **code / security / architecture / legal / document / quality / media / policy review, evaluations, and benchmark testing** — anywhere a single model's blind spot is expensive. Use it there; for variable renames, formatting, and simple CRUD, a single model is cheaper and entirely sufficient.

## Why single-model review falls short

The value of asking more than one model comes from **uncorrelated errors** — different models being wrong about different things. A single model gives you none of that:

- **One opinion, one blind spot.** You see what that model saw; you never see what it skipped.
- **Confidence is not calibration.** The model's tone is identical whether it is right or wrong. There is no internal "I'm unsure here" you can read off.
- **No surfaced disagreement.** A single call cannot show you the thing only *some* reviewers would have caught — because there is only one reviewer.
- **Model strength is task-dependent.** On the same set of tasks, one model catches an IDOR that another returns "no issues" on, and vice-versa. There is no single model that is best everywhere, so a single-model standard *guarantees* a class of misses.

Asking the *same vendor* for a second opinion does not fix this: its own "panel" is its own models, trained on its own data, sharing its own blind spots — correlated errors dressed up as agreement. The decorrelation that makes review valuable only exists **across** vendors. That cross-vendor check, reconciled by a neutral judge, is the thing a single-vendor API structurally cannot give you.

This is also why "just average the answers" is wrong: averaging destroys the lone dissent, which is frequently the finding that mattered. The design problem is to *preserve* dissent and adjudicate it, not smooth it away.

## How Council works

You call one tool; the orchestration, scoring, and reconciliation run server-side; you get one decision.

```
            ┌─ Claude  ─┐
your prompt ─┼─ GPT     ─┼──▶  independent judge  ──▶  one reconciled decision
            ├─ Gemini  ─┤      (disjoint, cross-     + the disagreements
            └─ …(2–6)  ─┘       family — never grades   that surfaced
                                 its own answer)
```

1. **Fan-out, parallel and blind.** Your prompt goes to 2–6 frontier proposers *in parallel*, across vendors (Anthropic, OpenAI, Google, and EU-hosted options). Each answers independently and sees none of the others — so there is no round-table where the lone dissenter caves to the majority. Selection favours **diversity + competence, not raw score**: picking only the top-scoring models converges on similar ones and *shrinks* the decorrelation that is the whole point.
2. **Independent judge.** One or more judge models — **disjoint from the proposers, cross-family, and never scoring their own proposal** — read the candidate answers and reconcile them: which claims are corroborated, which are outliers, which are simply wrong.
3. **One result, shaped by the mode you choose.** Depending on the [mode](#the-consensus-process), you get a single decided answer, a structured agreement/disagreement map, the strongest single answer verbatim, the full landscape plus a verdict, or the raw spread with no judge at all. There is **no universally-best mode** — you pick by what you need from *this* call.

**Read the council as a recall amplifier, not a truth oracle.** Its strength is recall: with several different vendors, you only need *one* to catch the timing side-channel or the missed edge case, and it gets surfaced. The cost is precision: more models means more flags, some of them nitpicks, so a human (or your agent) adjudicates. That trade is worth it for rare, high-asymmetric-cost decisions — and not for routine work.

## Architecture

```
                       ┌──────────────────────────────────────────────┐
   MCP client          │                Tokonomix gateway             │
 (Claude Code,         │                                              │
  Cursor, …)           │   ┌── proposer 1 ──┐                         │
       │  tool call    │   │   (vendor A)   │                         │
       ├──────────────▶│  ─┼── proposer 2 ──┤   blind, parallel       │
       │               │   │   (vendor B)   │   2–6 proposers         │
       │               │   └── proposer 3 ──┘                         │
       │               │           │                                  │
       │               │           ▼                                  │
       │               │   ┌────────────────┐  disjoint, cross-family │
       │               │   │  judge (panel) │  never judges own answer│
       │               │   └────────────────┘                         │
       │               │           │                                  │
       │   one result  │           ▼                                  │
       │◀──────────────│   synthesis + surfaced disagreement +        │
                       │   billing breakdown + request_id             │
                       └──────────────────────────────────────────────┘
```

Components:

- **Proposers** — the 2–6 models that answer the prompt. Chosen for cross-family decorrelation, not just raw score. Empirically selected from Tokonomix's own measurement layer (intelligence tests, arena games via TrueSkill, judge-reputation ok/wrong rates), with anti-Goodhart guards and an exploration budget so past winners aren't entrenched.
- **Judge** — disjoint from the proposers by default, cross-family, never scoring its own answer. Budget is auto-sized to the proposer count.
- **Gateway** — runs the orchestration, applies region/residency policy, meters cost, returns one result with a billing breakdown and a `request_id`. The gateway itself is EU-hosted; region selection controls which *model providers* see your prompt.
- **Per-key policy** — budget caps, default council/route, and allow-lists are set *on the API key*, not re-decided per call, so an unattended run can't overspend or send your prompt somewhere you didn't intend.

The orchestration favours **traceability**: every call returns the proposer models, the judge model, and `charged_credits`, so a decision-of-record can be reproduced — record those alongside the answer, because the default council can change server-side over time.

## The consensus process

`tokonomix_consensus_ask` is the core tool. The proposers are the dominant cost in *every* mode; the judge pass is the only differential between them. Pick the mode by intent — **there is no universally-best mode, including `diff`:**

| Mode | What you get | Judge? | Use it for |
|---|---|---|---|
| `consensus` *(default)* | One merged, **decided** answer built from the most-corroborated claims | 1 pass | "Just give me the decision I'll act on" |
| `diff` | A structured **agreements / disagreements / confidence** report. **The judge *compares*; it does NOT decide.** | 1 pass | When you'll adjudicate yourself but want the disagreement mapped |
| `best_of` | The judge picks the single strongest existing answer, **verbatim** (no merge) | 1 pass | When one model is likely fully right and merging would only dilute it |
| `full` | Every proposer answer **plus** the judge's per-model reasoning **plus** a conclusion, in one judge pass | 1 pass | Auditability — you want both the raw landscape *and* a verdict |
| `raw` | Every proposer's raw answer, **no judge** (cheapest) | none | You want the unfiltered spread and will reduce it entirely yourself |

`raw` skips the judge, so it is the cheapest; `diff`, `consensus`, `best_of`, and `full` each bill **one** judge pass (`full` returns the most detail for that same single pass — it is *not* an extra call). Reach for `raw` for control / no judge-bias, not mainly to save money; and don't pay for the judge in `diff` only to ignore its comparison.

**Every consensus answer also ends with a `## ⚠️ Blind spots & disagreements` section at no extra cost.** Read it as *surfaced* disagreement, not a correctness guarantee.

### Grounding — the single biggest lever

The largest determinant of a good consensus call is not the mode and not the number of models — it is **grounding**: feeding the council verifiable ground truth (the actual file, the real diff, the literal spec, the real logs). Ungrounded consensus amplifies a shared wrong prior into false confidence; grounded consensus checks a claim against reality. Two real catches we have observed existed *only* because the model could read the literal artifact — a U+2028 control-char bug invisible in any summary, and a relay-integrity gap that only appeared when the panel saw the verbatim spec rather than a paraphrase. The discipline:

- **Send the reviewed artifact verbatim and complete** — no summary, no `...`. The fault always lives in the literal details (a char-range, a control-flow order, a specific phrasing, an edge case named-or-not), and a summary hides exactly that. This holds for code, documents, configs, and instructions alike.
- **Facts maximal, steering minimal.** Give every relevant fact; give *no* leading hints ("watch the regex"). A hint pollutes the signal — you no longer know whether the model found it itself.
- **The hard limit is the smallest context window in the panel — judge included.** Exceed it and that member is silently truncated and effectively votes blind. Know the panel first (`tokonomix_list_models` reports `context_window`); doesn't fit → swap to a larger-window panel or split per module. **Never compress-to-fit** — that re-hides the faults grounding exists to surface.

You pass grounding either inline in the `prompt`, or via the structured `context` argument (server-gated) so the *same* context-pack is reused by every proposer **and** the judge — you pay for the context once, not once per model.

### The grounding-gate (refuse-to-judge-on-thin-input)

The genuine differentiator, and an honest one: rather than producing a confident blind review of input that is too thin to evaluate, the council can **ask back**. If a call returns `{status:"needs_context", request_id, missing, delivery_hint}` — a context request, *not* an error — the council **did not run and you were not charged**. `missing` lists the artifacts you referenced (a file, a diff, "this code") whose *content* you did not actually include. You gather the real content, attach it verbatim, and re-call with the **same `request_id`** to run the now-grounded council. For a genuinely artifact-less prompt (a general question with nothing to attach), set `acknowledge_ungrounded: true` with a short reason to force a best-effort verdict flagged `grounding:insufficient`.

> **Status:** the grounding-gate is **dormant / shadow-first today** — the `needs_context` / `continuation_id` / `acknowledge_ungrounded` plumbing exists in the MCP and gateway but is server-gated and not yet active by default. It is described here because it is the intended mechanism; do not assume it is enforcing on your account until the platform enables it.

## The judge

The judge is where a council either earns its keep or quietly fails, so its independence is a load-bearing design choice, not a detail:

- **Disjoint from the proposers by default.** The judge never wrote the answer it scores. A model never judges its own proposal — LLM self-preference bias is real and measured, and a non-disjoint judge that is also a proposer *inflates* agreement (see [specialist overlap](#when-consensus-helps--doesnt--can-hurt)).
- **Cross-family by preference.** A cross-family judge avoids inheriting one vendor's blind spot in the synthesis step. You can override the judge (`judge_model`) or run a multi-judge panel (`judge_models`, used for multi-judge `best_of`); prefer a cross-family choice.
- **A multi-judge panel lifts reliability, not the ceiling.** More judges damp one judge's idiosyncrasy (e.g. the known bias toward long, confident answers), but judges share training data with each other and with the proposers — so more judges raise *reliability*, they do not raise the truth ceiling. **Grounding does more than adding judges.**
- **The judge cannot exceed its own ground truth.** It dampens one model's idiosyncrasy; it cannot conjure a fact none of the proposers had and it didn't have either. This is the structural reason grounding matters more than panel size.

Auto-sizing: the judge's output budget scales with the proposer count (`4096 + 2048 × proposers`, with a `4096` floor and a `16384` ceiling). Note the judge step is hard-capped at `8192` output tokens on the standard consensus path regardless of your `max_tokens` — on very large structured outputs the *judge* can truncate even when proposers fit; batch or split rather than raising `max_tokens` past `8192`.

## When consensus helps / doesn't / can hurt

This section is the honest core of the product. Multi-model review is not free of failure modes — and several of ours are documented from our own validation, not hypothesised. Read it before you rely on a result.

### When consensus helps

- **Rare, high-asymmetric-cost decisions** — auth, migrations, GDPR, money, anything quoted to a regulator/customer — where one real catch pays for a lot of false alarms.
- **Variance-elimination.** You stop gambling on which single model you happened to ask: the council buys top-of-panel recall without your having to know in advance which model is strong for this task.
- **Surfacing disagreement.** `diff` mode drags the lone dissenter into the open instead of averaging it away — the split *is* the signal.
- **As a verification / agent-QA layer.** A cross-vendor check is the one thing your host agent's own sub-agents (one vendor) cannot reproduce.

### When consensus does NOT help

- **Routine work** — renames, formatting, simple classification, quick lookups. It adds cost and noise with no benefit. Use `tokonomix_single_ask` (~3× cheaper) or your own host model.
- **Tasks where any single strong model already saturates.** On easy, well-trodden problems the best single model already gets it right; the council *matches* it, does not exceed it (and costs more). See [Benchmarks](#benchmarks).

### When consensus can HURT

These are real limitations, named — honesty is the feature here, not a caveat to bury:

- **Lossy synthesis.** The judge can drop a real finding that a single member actually had — we have *observed* the merged answer being weaker than one member's own answer. If you need to be sure no finding is lost, use `diff` or `full` (which preserve per-model content) rather than `consensus`.
- **Correlated failures / shared hallucinations.** Frontier models share heavily overlapping training data. On a shared blind spot — post-cutoff facts, niche domains — they can agree *and be uniformly wrong*. The judge then hands you a confident wrong answer with a clean "blind spots" section that found nothing. **Agreement measures agreement, not truth.** The lever against this is grounding, not more models.
- **False consensus.** Apparent convergence can be an artifact of similar prompting, similar fine-tuning, or one dominant phrasing — not independent corroboration. Treat a unanimous answer on an out-of-distribution fact with the same suspicion you'd treat one model's.
- **Specialist overlap.** If the judge is *also* a proposer (a non-disjoint judge), it scores its own work and inflates the measured agreement. This is exactly why the default judge is disjoint and cross-family — but if you override the judge to a model already in the proposer list, you reintroduce the bias.

**The bottom line:** consensus reduces single-model error and surfaces disagreement a single model would hide. It does **not** guarantee correctness, it showed **no net uplift in catch rate** over a strong single model in our measured runs, and it is **not** a blind merge gate you should auto-trust. It is a recall amplifier that feeds your judgment.

## Decision Engineering vs existing techniques

Decision Engineering is not a brand-new idea pulled from nowhere — it composes several well-studied techniques and adds two things most of them lack: **cross-vendor independence** and **grounding against the real artifact**. This is an honest map of where it overlaps with and differs from related approaches. The point is *what problem each solves*, not "we're better than all of them" — several of these are mechanisms Council itself uses.

| Technique | What problem it solves | Where it overlaps Council | Where it differs |
|---|---|---|---|
| **LLM-as-Judge** | Scoring/ranking model outputs automatically | Council *uses* an LLM judge to reconcile | Council requires the judge be **disjoint and cross-family**; the common LLM-as-judge setup lets a model grade outputs from its own family (or its own answer), which inflates agreement |
| **Debate** (models argue to a conclusion) | Surfacing reasoning by making models challenge each other | Both aim to expose disagreement | Debate lets the louder/longer arguer win and can induce capitulation; Council keeps proposers **blind and parallel** so the lone dissent is *preserved*, not argued away |
| **Tree of Thought** | Better reasoning *within one model* by exploring branches | Both seek a more deliberate answer | ToT is single-model — one mind, one blind spot. Council's value is *cross-vendor* decorrelation, which ToT structurally cannot provide |
| **Self-Consistency** | Reducing variance by sampling one model many times and taking the majority | Both reduce the luck of a single sample | Self-consistency samples *the same* model, so it cannot escape that model's systematic errors; Council samples *different vendors*, whose errors are uncorrelated |
| **Mixture of Experts** | Efficient capacity by routing tokens to specialized sub-networks *inside* one model | Both use the word "experts" | MoE is an architecture detail of a single model (one vendor, shared training); Council's "experts" are independent vendors reconciled by an outside judge — a decision layer, not a model internal |
| **Ensemble Learning** | Lower variance by combining many models' predictions | Both combine multiple models | Classic ensembling **averages/votes**, which *destroys* the lone dissent that often matters; Council preserves and adjudicates dissent and adds grounding + an independent judge |
| **Constitutional AI** | Aligning a model to written principles via self-critique | Both care about a reasoned, principled output | Constitutional AI is *self*-critique inside one model against a rulebook; Council's check is *external* — a different vendor and real ground truth, not the same model marking itself |
| **Peer Review** (human) | Independent expert scrutiny before publication | Council is explicitly modelled on it — independent reviewers, a reconciling editor | Human peer review is slow, scarce, and inconsistent; Council is fast and reproducible, but its "reviewers" share training data, so it is **not** a substitute for human review on the highest-stakes calls — it feeds human judgment |
| **Static Analysis** | Deterministically flagging known defect classes in code | Both catch issues before they ship | Static analysis is exact and rule-bound (no false-negative drift, but blind to anything not encoded as a rule); Council reasons about *novel*, semantic, cross-domain issues a linter can't encode. They are complementary, not rivals |

**Where Council sits.** It is the layer that takes the genuinely useful parts of these — an LLM judge, ensemble combination, the peer-review structure — and adds the two properties the single-model and single-vendor versions cannot have: **independence across vendors** and **grounding against ground truth**. That, not novelty for its own sake, is the contribution.

## Council in the Tokonomix ecosystem

Council is one specialized building block among a growing set of Tokonomix components. Each is **standalone-usable**, but each owns one responsibility and points to where the adjacent ones live. Council owns **decision-making**; it does not try to be the whole stack.

| Component | Owns | Council's relationship |
|---|---|---|
| **Council** *(this repo)* | **decision-making** — independent review, consensus, reasoning-verification, grounding, judge-independence, decision confidence, auditability | — |
| **[ANS — Agents Never Sleep](https://github.com/TokonoMix/agents-never-sleep)** | **execution** — running a backlog to completion, unattended, with deterministic governance | Council is the verifier ANS *delegates a decision to*; ANS executes, Council does not |
| **Media QC** | **verification of media artifacts** — image/video/document output quality control | Council reviews *decisions and reasoning*; Media QC reviews *media outputs*. Council can take an image as grounding for a decision, but it does not own media QC |
| **Benchmark** | **measurement** — intelligence tests, arena, model/judge reputation | Feeds Council's empirical proposer/judge selection; Council consumes it, does not run it |
| **Routing** | **provider-selection** — which provider/model hosts a call | Council exposes a *region/residency policy* (EU-only data residency), but the underlying provider routing is Routing's job |
| **Memory** | **long-term context** — durable state across sessions | Council is stateless per call (it records a `request_id` for audit); persistent memory lives in Memory |

**If you need execution, scheduling, autonomy, memory, browser automation, or general provider routing, you are in the wrong component — Council only decides.** Point execution at **ANS**.

## Practical examples

### Code / security review (`diff` — preserve the dissent)

```js
tokonomix_consensus_ask({
  prompt: "Is this auth middleware safe? Review for timing side-channels, IDOR, and missing-auth paths.\n\n```ts\n" + middlewareSource + "\n```",
  mode: "diff"   // surface the one model that flags the constant-time issue; don't average it away
})
```
> Four models say "looks fine"; one flags the token comparison isn't constant-time. A single-model call would have returned "looks fine" and you'd have shipped it. `diff` surfaces the lone dissent so a human adjudicates the thing that actually matters.

### Migration safety check (`diff` — irreversible action)

```js
tokonomix_consensus_ask({
  prompt: "Is this migration reversible? Flag any irreversible step.\n\n" + migrationSql,
  mode: "diff"
})
```
> For a safety check you want the lone dissenter preserved, not averaged away.

### Compliance / legal interpretation (`consensus` — a decided answer)

```js
tokonomix_consensus_ask({
  prompt: "Can a SaaS legally store EU-citizen API logs in a US-hosted S3 bucket for 30 days under GDPR? Answer in 4 bullets: legal basis, Schrems II, alternatives, action plan.",
  mode: "consensus",
  models: ["claude-opus-4-8", "gpt-5.4", "gemini-2.5-pro"]   // slugs illustrative — confirm with tokonomix_list_models
})
```
> This prompt asks about a *practice* and carries no personal data, so a US frontier council is fine. **If the prompt contained actual customer records, keep the data EU-only** (next example).

### Personal-data prompt — EU data residency (mandatory for PII)

```js
// 1. discover the EU-hosted set
tokonomix_list_models({ hosting_region: "eu" })
// 2. pin the council to it — the default council is US-hosted
tokonomix_consensus_ask({ prompt: promptContainingPII, models: [/* EU slugs from step 1 */] })
```
> The default council is US-hosted. Sending a privacy question that *contains* personal data to three US clouds is itself a cross-border transfer — the very thing the question is trying to avoid. EU-only routing keeps prompts in-region — data-minimisation and a hedge against transatlantic-transfer risk. It is not a complete GDPR compliance statement; compliance depends on your whole system.

### Document / diagram QC (vision as grounding)

```js
tokonomix_consensus_ask({
  prompt: "Key differences between these two architecture diagrams? Focus on data-flow and security boundaries.",
  mode: "diff",
  images: [
    { data: "/9j/4AAQSkZJRgAB...", media_type: "image/jpeg" },
    { data: "iVBORw0KGgoAAAAN...", media_type: "image/png" }
  ]
})
```
> Vision input is grounding for a *decision* review (Council reasons about the diagrams) — not a media-QC pipeline. With no `models` set, the council auto-selects a current cross-vendor vision panel (a current Claude, Gemini, and GPT vision model — query `tokonomix_list_models({"supports":["vision"]})` for live slugs, which drift). `data` is raw base64 with **no** `data:image/...;base64,` prefix; allowed types are `image/jpeg`, `image/png`, `image/webp`, `image/gif`; ≤8 images, ≤5 MB decoded each, ≤20 MB total.

### Rating the result (feeds council selection)

```js
tokonomix_rate_consensus({ request_id: "…", score: 8, consensus_benefit: "caught_blind_spot" })
```
> Rate every call on its *true* value: a confirmation you solicited is a confirmation (`raised_confidence`), not a catch. (Dormant until the platform enables the feedback loop.)

## Installation

### 1. Get an API key (or onboard keyless)

Sign up at **[tokonomix.ai/dashboard/signup](https://tokonomix.ai/dashboard/signup)** — **€5.00 free credit**, no card required. Issue a key at `/dashboard/keys` (it starts with `tok_live_`).

Or onboard with no key at all: run `tokonomix_onboard("you@example.com")`, then `tokonomix_onboard_verify` with the emailed 6-digit code — it provisions a free-tier account (€5 credit) and saves the key to `~/.tokonomix/credentials.json` (mode 0600). No env var needed after that.

### 2. Add it to your client

**Quick add (Claude Code):**

```bash
claude mcp add council npx tokonomix-council-mcp
```

Then set `TOKONOMIX_API_KEY` in your environment (or let the MCP pick it up from `~/.tokonomix/credentials.json` after `tokonomix_onboard`).

**Manual config — Claude Code** (`.mcp.json` in your project, or `~/.claude.json`):

```json
{
  "mcpServers": {
    "tokonomix": {
      "command": "npx",
      "args": ["-y", "tokonomix-council-mcp"],
      "env": { "TOKONOMIX_API_KEY": "tok_live_..." }
    }
  }
}
```

**Cursor / Cline / Continue / Zed** — the same `command` + `args` + `env` triple goes in your tool's MCP-server config.

### 3. Configuration

| Env var | Default | Description |
|---|---|---|
| `TOKONOMIX_API_KEY` | — *(optional after onboarding)* | Bearer key, starts with `tok_live_` |
| `TOKONOMIX_BASE_URL` | `https://tokonomix.ai/api/v1` | OpenAI-compatible base (council). Anthropic base: `https://tokonomix.ai/api/anthropic` |
| `TOKONOMIX_SITE_URL` | derived from base | Main-app origin for the keyless onboard endpoints |

### 4. The tools

The MCP server exposes ten tools, all prefixed `tokonomix_`:

| Tool | What it does |
|---|---|
| `tokonomix_consensus_ask` | The core: 2–6 proposers + independent judge → one result (modes above) |
| `tokonomix_single_ask` | Single-model passthrough — cheap, for routine calls |
| `tokonomix_list_models` | Live catalog, filterable by region, provider, tier, capability, origin country |
| `tokonomix_get_balance` | Credit balance, tier, and month-to-date usage (€ spent **and** token throughput, by mode) |
| `tokonomix_rate_consensus` | Rate a result by `request_id` — feeds model votes / blind-spot reputation *(dormant: returns 404 until the platform feedback-loop is enabled)* |
| `tokonomix_upload` | Stage large context for a grounded call → `session` + `handles` *(dormant: returns "not enabled" until context-upload is enabled)* |
| `tokonomix_onboard` | Keyless first run, step 1 — email a one-time code |
| `tokonomix_onboard_verify` | Keyless first run, step 2 — provision a free account + save the key |
| `tokonomix_get_skill` | Fetch the canonical usage skill from the server |
| `tokonomix_skill_version` | Cheap version fingerprint of the skill (detect drift) |

### The skill

The package ships a `tokonomix-consensus` skill (`skill/tokonomix-consensus/SKILL.md`) that teaches your agent *when* to reach for consensus (and which mode) versus a single call. Drop it into `.claude/skills/`, or let the agent pull it at runtime via `tokonomix_get_skill`. The server's copy is canonical — `tokonomix_skill_version` detects drift.

## Integration & API surfaces

Beyond the MCP tools, the gateway exposes two HTTP surfaces with **different capability profiles** — worth knowing when an agent needs native tool-calling or structured output:

| Surface | Endpoint | Shape | tool-calling · structured-output · web-search · prompt-caching |
|---|---|---|---|
| **Council** (multi-model) | `POST /api/v1/chat/completions` | OpenAI-compatible | **not forwarded** — consensus fans out to N proposers + a judge; tool-calls/structured-output can't be averaged, so they are single-model-only |
| **Single-model** | `POST /api/anthropic/v1/messages` | Anthropic Messages wire-format · **routes to any provider** (OpenAI, Google, Anthropic, OVH-EU, Azure, xAI, Ollama…) | **forwarded** — `tools`/`tool_choice` + server-tools (web search) round-trip as `tool_use`; `cache_control` prompt-caching is billed at cache-tier rates |

Use the **council path** (or `tokonomix_consensus_ask`) when you want a verified, synthesized decision; use the **single-model path** when an agent needs native function-calling, schema-constrained output, or prompt caching. That path speaks the Anthropic Messages wire-format but is **not Anthropic-only** — the gateway sends your call to whichever configured provider hosts the model you name.

> **Agentic tool-use** (e.g. running an external code-review harness through Tokonomix): point the client at `https://tokonomix.ai/api/anthropic` with the Anthropic wire format, and **unset any ambient `ANTHROPIC_API_KEY`** — some SDKs send it as `x-api-key` alongside your `tok_live_` bearer, which the gateway rejects.

### Per-key guardrails

Budget and region policy are set **on the key**, not re-decided per call:

- a **predefined default model + council route** — which proposers, which judge, which mode;
- a gateway-enforced **monthly spend cap** (`monthly_limit_cents`) — the key is blocked once the month's charged spend would exceed it;
- **allow-lists** by model / mode / judge / hosting region / model-origin country.

So you can hand a key to an unattended run and trust it can't overspend or send your prompt somewhere unintended. Track usage with `tokonomix_get_balance` (€ **and** tokens, month-to-date).

## Benchmarks

We publish what we measured — including, prominently, where the numbers cut against us. **No benchmark figure here is fabricated, and we claim no accuracy or bug-catching uplift.** Two findings are load-bearing:

### Finding 1 — No measurable net uplift in bug-catch rate (SWE-bench, round 2, N=29)

A round-2 validation on SWE-bench-Verified defect tasks **falsified** the "consensus catches more bugs" hypothesis. A non-Anthropic baseline (GPT-4o) missed **29 of 30** real bugs; running a cross-family council on those 29 produced **no measurable net uplift in catch rate** over simply re-running the agent — the council occasionally caught a miss, but false-positive flags netted it out (effect +0.12, CI crossing zero). The precise, honest claim is therefore *no net uplift* — **not** *"catches no more bugs"* (which would over-claim the other way). We do not, anywhere, claim the council catches more bugs.

### Finding 2 — Council ties best-single on clean accuracy, beats it nowhere (benchmark v2, 5 domains)

Across a 5-domain benchmark (v2), the council **equalled the best single model** and **beat it in no domain**. On clean, well-trodden tasks a strong single model already saturates, and the council matches it at higher cost. The winner *shifts* by domain — which is the actual case for the product: the council buys you **variance-elimination** (top-of-panel recall without knowing in advance which model is strong), not a higher accuracy ceiling.

### Honest positioning that follows from the data

The measured value is **variance-elimination + verification / agent-QA + judge-independence + EU data residency + grounding** — *not* "more accurate" and *not* "catches more bugs."

**Methodology over flattery.** Every number above is tied to a reproducible method on a public dataset (SWE-bench-Verified for Finding 1) and points the same direction: the council *ties*, it does not beat. Where we have only a process rule (e.g. grounding improves recall via a mechanistically convincing case), we say "process rule, not a measured effect size" and do not put a percentage on it. Full datasets + harnesses behind these findings are being prepared as a reproducible publication (see Roadmap) so the method, not the marketing, is the artifact.

## Glossary

Consistent terminology, so a human or an AI agent parses the same words the same way throughout these docs.

| Term | Meaning |
|---|---|
| **Decision engineering** | Designing *how* a decision is produced — independent inputs, an independent reconciler, grounding, auditability — rather than trusting one model's single output. Council is a reference implementation of it — the first concrete one of the principles we define here; there is no external spec or second implementation yet. |
| **Decision quality** | The goal Council optimises for: a decision that is right *and* auditable. Expressed as **Consensus × Ground Truth = Decision Quality** — consensus is one mechanism, grounding (the strongest) is another, judge-independence and verification are others. |
| **Reference implementation** | A concrete, working build that demonstrates a discipline end-to-end — a factual description of Council, not a market-ranking claim. It is the *first* such build of the principles we define here: there is no external spec or second implementation yet, and no outside party has adopted it. (We do not claim "industry standard.") |
| **Proposer** | One of the 2–6 models that answers the prompt independently and blind. |
| **Judge** | The model that reconciles the proposers' answers. Independent by design. |
| **Disjoint judge** | A judge that is *not* one of the proposers, so it never scores its own answer. |
| **Cross-family judge** | A judge from a different vendor/model-family than the proposers, so it does not inherit their shared blind spot. |
| **Consensus mode** | One merged, **decided** answer from the most-corroborated claims. (Default.) |
| **Diff mode** | A structured agreements/disagreements/confidence report — the judge *compares*, it does **not** decide. |
| **Best_of mode** | The judge picks the single strongest existing answer verbatim, no merge. |
| **Raw mode** | All proposer answers, **no judge** — the unfiltered spread (cheapest). |
| **Full mode** | All proposer answers + the judge's per-model reasoning + a conclusion, in one judge pass (auditability). |
| **Grounding** | Feeding the council the real artifact (file, diff, spec, logs) so claims are checked against reality instead of a shared prior. The single biggest lever. |
| **Lossy synthesis** | A failure mode where the judge drops a real finding a single member had, making the merged answer weaker than that member's own answer. |
| **Correlated failure** | Frontier models sharing training data are wrong about the *same* thing, so agreement is not proof of correctness. |
| **False consensus** | Apparent convergence caused by similar prompting/fine-tuning rather than independent corroboration. |
| **Specialist overlap** | A non-disjoint judge (also a proposer) scoring its own work and inflating measured agreement. |
| **Recall vs precision** | Recall = catching the rare real issue (Council's strength: only one vendor needs to see it). Precision = avoiding false flags (Council's cost: more models → more flags to adjudicate). |
| **Decision confidence** | The agreement/disagreement signal Council *surfaces* — the `diff` report and the per-answer blind-spots section. It is a surfaced signal for your judgment, **not** a calibrated probability the answer is correct. |
| **Variance-elimination** | Council's honest value: you stop gambling on which single model you happened to ask; you get top-of-panel recall without knowing in advance which model is strong. |
| **Grounding-gate** | The dormant/shadow-first mechanism by which Council can refuse to judge too-thin input and ask back for the real artifacts instead of guessing. |

## FAQ

**Is this a model, or a chatbot?**
Neither. It is a decision-engineering layer *above* models. It doesn't make any model smarter; it changes how several models' outputs become one decision. It is not a multi-model chat, a voting system, or an averaging system.

**Does the council give more accurate answers than the best single model?**
No — and we will not claim it does. In our validation it *ties* the best single model on clean accuracy and beats it in no domain, and it showed no net uplift in catch rate on a SWE-bench run. Its measured value is variance-elimination, verification, judge-independence, EU data residency, and grounding.

**So why pay for it?**
Because *which* single model is best shifts per task, and you usually don't know in advance which one. The council buys top-of-panel recall without that bet, surfaces disagreement a single model hides, and gives you a cross-vendor check no single-vendor API can. For rare, high-cost decisions that's worth more than its cost; for routine work it isn't — use `tokonomix_single_ask`.

**If consensus is the means, what's the goal?**
Better decision quality. Consensus is one mechanism we use to get there; grounding and judge-independence are others. We optimise for the decision being right and auditable, not for models agreeing.

**Can a single vendor sell me the same thing?**
No. OpenAI can't grade Claude, Anthropic can't grade Gemini, Google can't grade GPT. A vendor's own "panel" shares its own training data and blind spots — correlated errors dressed up as agreement. The decorrelation only exists *across* vendors.

**Does agreement mean the answer is correct?**
No. Frontier models share training data, so they can agree *and be uniformly wrong* (shared hallucination, correlated failure). Agreement raises confidence, not correctness. For out-of-distribution or post-cutoff facts, still verify against a primary source — and ground the call.

**Can consensus be worse than a single model?**
Yes, and we say so: lossy synthesis (the judge dropping a real finding), correlated failures, false consensus, and specialist overlap (a non-disjoint judge inflating agreement). See [When consensus helps / doesn't / can hurt](#when-consensus-helps--doesnt--can-hurt). Use `diff`/`full` when you can't afford a lost finding, and ground the call.

**Can Council run, schedule, or remember my work?**
No — that is out of scope by design. Council only *decides*. Execution and unattended backlog runs are **[ANS](https://github.com/TokonoMix/agents-never-sleep)**; long-term memory, browser automation, and general provider routing live in their own components. See [Council in the Tokonomix ecosystem](#council-in-the-tokonomix-ecosystem).

**What about personal data / GDPR?**
If the prompt contains personal/identifiable data, keep it EU-only: `tokonomix_list_models({hosting_region:"eu"})` then pin those slugs. The default council is US-hosted. EU-only routing keeps prompts in-region — data-minimisation and a hedge against transatlantic-transfer risk. It is not a complete GDPR compliance statement; compliance depends on your whole system.

**Is the grounding-gate live?**
The plumbing exists but is dormant / shadow-first — server-gated, not enforcing by default yet. Treat it as the intended mechanism, not a guarantee on your account today.

**How do I keep a decision reproducible?**
Record the proposer models, the judge model, `charged_credits`, the date, and the exact prompt — all returned in the billing breakdown. The default council can change server-side over time, so the same prompt may use different models next month.

## Documentation

The companion docs frame Council from **AI Decision Engineering**, not from the wire
protocol. Start with the [tutorial](docs/tutorial-getting-started.md) or the
[glossary](docs/glossary.md); read the [manifesto](docs/decision-engineering-manifesto.md)
for the full argument. Every term is used consistently across the suite (see the
glossary), and each doc carries an accessible diagram.

- **[Decision Engineering Manifesto](docs/decision-engineering-manifesto.md)** — the standalone statement of the field.
- **[Glossary](docs/glossary.md)** — one consistent vocabulary for the whole suite.
- **[Tutorial: Your First Consensus Call](docs/tutorial-getting-started.md)** — hands-on getting started.
- **[Decision Theory](docs/decision-theory.md)** — why one model is one perspective; independent multi-model review.
- **[Consensus](docs/consensus.md)** — the mechanism and the synthesis modes, by intent.
- **[Judge Independence](docs/judge-independence.md)** — the independent, cross-family LLM-as-judge.
- **[Grounding](docs/grounding.md)** — the strongest lever on decision quality, stronger than more models.
- **[Verification](docs/verification.md)** — the AI verification layer; why a model cannot verify itself.
- **[Confidence](docs/confidence.md)** — why agreement raises confidence, not correctness.
- **[Bias](docs/bias.md)** — self-preference and shared training-data bias.
- **[Recall vs Precision](docs/recall-vs-precision.md)** — the recall amplifier and its precision cost.
- **[Failure Modes](docs/failure-modes.md)** — the honest centrepiece: when consensus helps, doesn't, or hurts.
- **[Benchmark Methodology](docs/benchmark-methodology.md)** — reproducible method and the real (incl. falsified) findings.
- **[Architecture](docs/architecture.md)** — request → proposers → judge → decision + audit trail.
- **[Routing](docs/routing.md)** — panel selection and EU-default data residency.
- **[Auditability](docs/auditability.md)** — traceability and the rating feedback loop.
- **[Diagrams](docs/diagrams/)** — accessible SVGs (`<title>`/`<desc>`) embedded in the docs above.

## Roadmap

Honest about what's live versus planned:

- **Grounding-gate go-live.** Move the refuse-to-judge-on-thin-input gate from dormant/shadow-first to enforcing, once shadow metrics validate it doesn't over-bounce.
- **Context-upload (`tokonomix_upload`).** Activate the shared, region-pinned context-pack so large artifacts are staged once and read by every proposer + judge.
- **Consensus feedback-loop go-live.** Enable `tokonomix_rate_consensus` structured findings (real/false split, `consensus_benefit`) to feed live council selection and blind-spot reputation.
- **Reproducible benchmark publications.** Publish the full datasets + harnesses behind the findings above (including the falsified bug-catching claim), so the method — not the marketing — is the artifact.
- **Decision-engineering docs — now published** (see [Documentation](#documentation) above): Decision Theory · Consensus · Judge Independence · Grounding · Verification · Confidence · Bias · Recall vs Precision · Failure Modes · Architecture · Benchmark Methodology · Routing · Auditability · Glossary · a getting-started tutorial · accessible diagrams. Still planned: honest side-by-side comparisons with adjacent techniques (single-model review, peer review, LLM-as-judge, ensembles, self-consistency, tree-of-thought, multi-agent orchestration).
- **The Decision Engineering Manifesto** ([`docs/decision-engineering-manifesto.md`](docs/decision-engineering-manifesto.md)). The standalone statement of the field: why it exists, the design principles, the failure modes, why one model — and consensus alone — is insufficient, why grounding is necessary, and why the human stays ultimately accountable. The README links to it rather than duplicating the depth.

## License

MIT © [Tokonomix.ai](https://tokonomix.ai) / InterIP Networks

## Issues & feedback

[github.com/tokonomix/tokonomix-council-mcp/issues](https://github.com/tokonomix/tokonomix-council-mcp/issues) · `support@tokonomix.ai`
