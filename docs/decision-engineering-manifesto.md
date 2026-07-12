# The Decision Engineering Manifesto

*A discipline for how autonomous systems make important decisions — and a reference implementation that practices it.*

**Status:** position paper, v1 (2026-06-29). Maintained by Tokonomix / InterIP Networks.
**Companion:** the Council MCP README (a reference implementation this document argues for — the first one of a discipline we propose, with no external spec or second implementation yet).
**Citation:** *The Decision Engineering Manifesto*, Tokonomix Council, 2026.

---

## Preface: why this document exists

Software engineering matured by inventing disciplines for failure classes it could no longer catch by hand. We wrote tests when programs grew too large to reason about in one head. We built continuous integration when "works on my machine" stopped scaling. We adopted code review when we accepted that no single author sees their own blind spots. We added static analysis, then DevOps, then observability — each a *named discipline* with its own tools, its own rituals, its own definition of done, governing a class of error that was previously invisible until it cost someone something.

A new failure class has arrived, and it does not yet have a discipline.

Autonomous systems — agents, copilots, pipelines, and the LLMs underneath them — now *make decisions*, not just produce text. They decide whether a migration is reversible, whether an auth path is safe, whether a clause is GDPR-compliant, whether a refactor is correct, whether a benchmark result is trustworthy. They make these decisions the way a single confident person makes them: with one perspective, one set of priors, one blind spot, and a tone of certainty that is identical whether they are right or wrong. And then — increasingly — they *act on those decisions without a human in the loop*.

This is the failure class we cannot catch by hand anymore. It is too fast, too frequent, and too confident.

This document argues that the response is a discipline: **Decision Engineering** — the deliberate engineering of *how a decision is produced*, rather than trusting whatever a single model emits. It states the thesis, traces why the discipline is becoming necessary, makes the fundamental argument for why models cannot solve this for themselves, sets out the principles and design principles, ranks the mechanisms *honestly* (including the ones that do not work as advertised — even our own), explains why a human remains ultimately accountable, and points at Council as a reference implementation of these ideas.

It is written to be honest before it is written to be persuasive. The most important section of this manifesto is the one where we report a result that cut against us: our own validation **falsified** the most attractive claim we could have made about consensus. We keep that result in the foreground deliberately. A discipline that hides its negative findings is not engineering; it is marketing. Decision Engineering, to be worth the name, must be the field that describes honestly *when its methods work and when they do not.*

---

## 1. Thesis

> **Important AI decisions need an engineering discipline, because a single model is a single point of failure with a single blind spot — and it will never tell you what it didn't consider.**

The thesis has two halves.

**The first half is about the nature of a single model.** A language model is one perspective. It was trained on one corpus, shaped by one fine-tuning regime, and carries one distribution of priors and blind spots. When you ask it a hard question, you get *that* perspective, rendered with complete fluency and complete confidence — and critically, with no surfaced account of what it skipped, doubted, or never knew. For a chat reply this is fine. For a decision whose cost is asymmetric — where being wrong is far more expensive than being right is cheap — it is a structural liability. You are betting an expensive outcome on a single opinion that cannot show you its own uncertainty.

The reflex response — "use a bigger model" — does not address the failure. A bigger single model is still *one* opinion with *one* blind spot that still won't tell you what it missed. And *which* single model is strongest is not stable: it shifts per task, per domain, per bug class. There is no model that is best everywhere. Standardise on one and you guarantee a class of misses — the cases where the model you picked is exactly the one with the blind spot, and you never see a disagreement because there is no one to disagree.

**The second half is about the nature of a decision.** A decision is not the same artifact as an answer. An answer is a string of text; a decision is something you *act on*, often irreversibly, often without re-examination. The moment an autonomous system stops handing answers to a human and starts executing on its own conclusions, the quality of the *decision process* — not just the quality of the model — becomes the thing that determines whether the system is safe to deploy.

Decision Engineering is the discipline of taking that decision process seriously: engineering independent inputs, an independent reconciler, grounding against reality, surfaced disagreement, and an auditable record — so that the decision an autonomous system acts on is one you could defend afterward, rather than whatever one model happened to emit.

This is not a claim that more models make answers *more accurate*. We will be unusually careful about that claim, because our own data does not support it (see §6 and §9). It is a claim that the *engineering of the decision* is a discipline distinct from the engineering of the model — and that it is now necessary.

---

## 2. Why Decision Engineering is becoming necessary

Every mature engineering discipline added a layer of governance the moment a failure class outgrew unaided human attention. The history of software is a history of exactly this:

| Era | Discipline introduced | Failure class it governs |
|---|---|---|
| Programs outgrew one head | **Testing** | Regressions — code that silently stops doing what it did |
| "Works on my machine" stopped scaling | **Continuous Integration** | Integration drift — components that pass alone, fail together |
| We accepted authors don't see their own gaps | **Code Review** | Blind spots — defects invisible to the person who wrote them |
| Bug classes became mechanical to detect | **Static Analysis** | Whole categories of defect (null-deref, injection, type errors) |
| Deploys became too risky to do by hand | **DevOps / CD** | Release fragility — manual, irreproducible, unrecoverable deploys |
| Production became too complex to reason about blind | **Observability** | Silent runtime failure — systems wrong in ways no one is watching |

Read the right-hand column as a single sentence: *each discipline exists because a class of error became too frequent, too fast, or too subtle to catch by hand, and a human reviewing case-by-case could no longer keep up.* The discipline is not a tool; it is the institutionalised admission that unaided attention had hit its ceiling.

We are now at exactly that ceiling for a new failure class: **autonomous decisions made by single models, acted upon without review.**

Three forces make the discipline necessary now, not later:

**Volume.** Agents make thousands of decisions where a human used to make one. You cannot review each by hand any more than you can manually test each commit. The economics that forced testing now force decision governance.

**Autonomy.** The human-in-the-loop is being removed by design — that is the *point* of an agent. When a model's decision is executed without a checkpoint, the decision process *is* the only safeguard. There is no later moment where a person catches the mistake; there is only the quality of how the decision was produced.

**Confident wrongness.** A model's failure mode is uniquely dangerous: it is wrong with the *same* fluency and certainty it is right. There is no surface tell. A junior engineer hedges when unsure; a model does not. This is precisely the property that defeats unaided human attention — you cannot triage by confidence, because confidence is uninformative.

Code review was once a controversial overhead; now shipping unreviewed code to production is considered negligent. Decision Engineering is on the same trajectory. Today, letting an autonomous system act on a single model's unverified, ungrounded, unaudited decision feels normal. The argument of this manifesto is that it will come to feel the way unreviewed, untested production code feels today: not faster, just unaccountable.

---

## 3. Why LLMs cannot solve this themselves

The natural objection is: *models keep getting better — won't a sufficiently good single model just make good decisions, making this discipline unnecessary?*

No. And the reason is not that today's models are weak. It is structural, and it survives any amount of capability improvement.

> **The fundamental argument: a model cannot independently verify itself.**

A model asked to check its own answer is the same system, with the same training data, the same priors, and the same blind spots, grading its own work. If a fact is missing from its world model, it is missing from both its answer *and* its self-check — the gap is invisible from inside. If a bias shapes its conclusion, the same bias shapes its evaluation of that conclusion. Self-grading is a **conflict of interest** in the precise sense the term carries in auditing, science, and law: the party with an incentive to find the work sound is the party doing the review. We do not let an author peer-review their own paper, an engineer sign off their own deploy to production, or a company audit its own books — not because any of them is incompetent, but because *independence is a property of the configuration, not of the skill of the participant.* A brilliant author still cannot referee their own paper.

This generalises past the single model. It is why a single vendor cannot sell genuine verification of its own outputs: **OpenAI cannot independently grade Claude, Anthropic cannot independently grade Gemini, Google cannot independently grade GPT.** A vendor's own "panel" is its own models, trained on its own data, sharing its own blind spots — correlated errors dressed up as agreement. The independence that makes verification meaningful exists only *across* vendors and families, and it is exactly the thing a single-vendor product structurally cannot provide.

Two empirical facts sharpen the argument:

- **LLM self-preference is real and measured.** Models systematically rate their own outputs more favourably than a neutral party would. A judge that also wrote one of the answers inflates agreement — not from malice, but because self-preference is a measured property of these systems. A decision process that lets a model grade its own work is *building the bias in.*
- **Confidence is decoupled from correctness.** A model's expressed certainty is not a calibrated probability of being right. It cannot, from the inside, distinguish "I'm confident and correct" from "I'm confident and wrong." Self-verification asks exactly the question the model is least equipped to answer about itself.

The conclusion is not "models are untrustworthy." It is that *trust must be engineered into the configuration around the model, not assumed inside it.* You get verification by adding an **independent** party with a **different** blind spot, and — even more — by checking the decision against **ground truth** that no model's priors can override. That is an engineering problem about how decisions are produced. It is Decision Engineering, and no amount of single-model capability dissolves it, because the problem was never capability. It was independence.

---

## 4. The principles of Decision Engineering

These ten principles describe how an autonomous system *should* arrive at an important decision. They are normative — a checklist for any decision process worth trusting, whether or not it uses Council. Each is stated, then justified.

**1. Verify before acting.**
A decision that will be executed without review must be checked *before* execution, not explained after a failure. Verification is the only safeguard left once the human-in-the-loop is removed. The cost of a check is bounded; the cost of acting on a wrong decision is not.

**2. Preserve disagreement.**
When independent reviewers disagree, the disagreement is the signal — frequently the *most* valuable signal, because it points exactly at the contested, high-risk part of the decision. The cardinal sin is averaging it away. Averaging destroys the lone dissent, which is often the one finding that mattered; the discipline is to *surface and adjudicate* disagreement, not smooth it into a false unanimity.

**3. Separate execution from judgement.**
The system that *does* the work should not be the sole authority on whether the work is correct. An executor optimises for completing the task; a judge optimises for whether it should have been completed at all. Fusing the two means the thing under the most time-pressure to ship is also the thing deciding it is safe to ship.

**4. Separate reasoning from verification.**
Producing an answer and checking an answer are different jobs with different failure modes, and they must not be done by the same party in the same pass (see §3). The reasoner generates; an *independent* verifier, with a different blind spot, checks. Collapsing them reintroduces the self-grading conflict of interest.

**5. Separate confidence from correctness.**
A model's expressed confidence is a property of its tone, not a probability of being right. A decision process must treat confidence and correctness as *distinct axes* — never reading high confidence as evidence of correctness. The most dangerous decisions are the confidently-wrong ones, precisely because confidence offers no warning.

**6. Prefer evidence over agreement.**
Agreement measures agreement; it does not measure truth. Models that share training data can agree *and be uniformly wrong*. A decision grounded in a verifiable artifact — the actual file, the real diff, the literal spec, the real logs — is worth more than a decision a dozen models concur on without checking reality. **Evidence beats consensus; consensus without evidence is shared confidence, not correctness.**

**7. Expose uncertainty.**
The thing a single model never gives you is an honest account of what it is unsure about. A decision process must *surface* uncertainty — which claims are corroborated, which are outliers, which are contested — and hand it to whoever is accountable. A decision that hides its own uncertainty has hidden the part most needed to act wisely.

**8. Make decisions auditable.**
A decision you cannot reconstruct is a decision you cannot defend, learn from, or correct. Every important decision should carry its record: the inputs, the participants, the disagreements, the grounding, the cost, the identifier. Auditability is what turns "the system decided X" into "here is exactly how, and here is where to look if X was wrong."

**9. Remain reproducible.**
A decision process whose result you cannot reproduce is not engineering; it is anecdote. Reproducibility means a documented method, recorded participants, and a stated date — acknowledging that the underlying models drift, so the record must pin *which* configuration produced *this* decision. Without it, "we checked" is unfalsifiable.

**10. Never hide failure modes.**
The discipline must name, in the open, every condition under which it *does not work* — including from its own validation. A decision tool that conceals when it fails is more dangerous than no tool, because it converts a known risk into an unexamined one. This is the keystone principle, and the spine of this document: **honesty about failure is not a caveat; it is the discipline.**

---

## 5. The design principles

The ten principles above say what a good decision *process* must do. These nine **design principles** say how to build a *system* that does it. They are the engineering counterparts — the properties a reference implementation must hold.

**Single Responsibility.**
A decision component owns *decisions* and nothing else — not execution, not scheduling, not memory, not routing, not workflow. A clear, narrow boundary is what makes a component trustworthy to compose with: you can reason about what it guarantees precisely because you can reason about what it refuses to do. Scope creep destroys verifiability.

**Independence.**
Reviewers must be genuinely decorrelated — different vendors, different model families, different blind spots. The reconciler (the judge) must be *disjoint* from the reviewers: it never grades an answer it wrote. Independence is the load-bearing property of the entire discipline; without it, the rest is theatre (see §3).

**Ground Truth.**
The system must be built to check claims against the *real artifact*, not against a shared prior. Grounding — feeding verifiable evidence into the decision — is, empirically, the single largest determinant of decision quality (see §6). A design that makes grounding easy and ungrounded confidence hard is doing the most important thing right.

**Evidence First.**
When evidence and agreement conflict, evidence wins. The system should privilege a claim checked against reality over a claim many models merely concur on. This is principle 6 made structural: the architecture should reward grounding over mere convergence.

**Auditability.**
Every decision returns its own record — participants, disagreements, cost, identifier — so it can be reconstructed and defended later. Auditability is not logging bolted on; it is a first-class output of the decision.

**Transparency.**
The system shows its work: which models participated, where they disagreed, what was uncertain. It does not present a smooth verdict that conceals a contested decision. Transparency is what lets a human (or a downstream system) apply judgement to the *right* part of the decision.

**Reproducibility.**
The method is documented and the configuration is recorded, so a decision can be re-derived. The system acknowledges model drift explicitly and pins the record to a date and a configuration rather than pretending the substrate is static.

**Traceability.**
Every decision carries a stable identifier and a complete provenance chain, so it can be referenced, rated, corrected, and connected to its downstream consequences. Traceability is what makes a decision a *thing in the world* rather than a transient string.

**Human Accountability.**
The system is designed to keep a human ultimately accountable — surfacing uncertainty and disagreement *to* a responsible party rather than auto-resolving them away. It is a tool that *feeds* judgement, never one that launders away the need for it (see §7).

---

## 6. The mechanisms, honestly ranked

Decision Engineering is not a single technique. It is a small set of mechanisms, and they are **not equally powerful.** The central, honest finding of our own work is the ranking itself:

> **Decision Quality = Consensus × Ground Truth.**
>
> Consensus alone is a weak multiplier. Ground truth is the strong one. Multiplied together they produce decision quality; either alone is insufficient, and **grounding is the larger lever.**

We rank the mechanisms from strongest to weakest, and — per principle 10 — we name where each one *fails*.

### 6.1 Grounding — the strongest mechanism

Grounding means feeding the decision process verifiable ground truth: the literal file, the real diff, the actual spec, the real logs — verbatim and complete, not summarised. It is the single largest determinant of a good decision, **stronger than the number of models and stronger than consensus itself.**

The reason is principle 6 made physical. Ungrounded, models reason from a shared prior; if that prior is wrong, agreement only amplifies it into false confidence. Grounded, they check a claim against reality, where a shared blind spot cannot hide. Two real catches in our own use existed *only* because a model could read the literal artifact: a control-character bug invisible in any summary, and a relay-integrity gap that appeared only when the panel saw the verbatim spec rather than a paraphrase. Neither was a "smarter model" win; both were grounding wins.

The discipline of grounding:
- **Send the artifact verbatim and complete** — no summary, no elision. The fault always lives in the literal details (a character range, a control-flow order, a specific phrasing, an edge case named-or-not), and a summary hides exactly that.
- **Facts maximal, steering minimal.** Provide every relevant fact and *no* leading hints. A hint pollutes the signal: you can no longer tell whether the model found the issue itself.
- **Never compress to fit.** The hard limit is the smallest context window in the panel — the judge included. Exceeding it silently truncates a member, who then effectively reviews blind. Compressing-to-fit re-hides the very faults grounding exists to surface; split the work instead.

**The honest refusal.** The strongest expression of grounding-first design is a decision process that *refuses to judge input too thin to evaluate* and asks back for the real artifacts, rather than producing a confident blind review. Naming "I cannot responsibly decide this without the actual evidence" is, itself, a higher-quality decision than a fluent guess. (In Council this is the *grounding-gate*; it is dormant / shadow-first today, described honestly as intended mechanism, not as an enforced guarantee.)

**Where grounding fails:** when the relevant evidence genuinely does not fit any available context window and cannot be split, or when no artifact exists (a truly general question). Then grounding cannot help and the decision rests on weaker mechanisms — which must be flagged as such, not silently treated as grounded.

### 6.2 Judge independence — necessary, not sufficient

A reconciler that also wrote one of the answers grades its own work and inflates agreement (§3). So the judge must be **disjoint** (never one of the proposers) and **cross-family** (a different vendor, so it does not inherit the proposers' shared blind spot). This is the difference between honest reconciliation and self-congratulation.

But independence has a ceiling. **A judge cannot exceed its own ground truth.** It can damp one model's idiosyncrasy; it cannot conjure a fact none of the proposers had and it didn't have either. A multi-judge panel raises *reliability* (it averages out one judge's quirks, like the known bias toward long, confident answers) but **not the truth ceiling** — judges share training data with each other and with the proposers. This is the structural reason grounding outranks panel size: more judges sharpen the reconciliation; only ground truth can raise the ceiling on what is reconcilable.

**Where it fails:** *specialist overlap* — if you override the judge to a model already in the proposer list, you reintroduce the self-grading bias the disjoint default exists to prevent.

### 6.3 Consensus — useful, and the most over-claimed

Consensus — several independent models reviewing the same problem, their findings reconciled — is the mechanism most people *mean* by "multi-model," and it is the one whose value is most over-stated, including by people selling it.

Here is the value, stated precisely. Consensus is a **recall amplifier.** Its strength is recall: with several decorrelated vendors, you only need *one* of them to catch the timing side-channel or the missed edge case for it to surface. Its cost is precision: more models means more flags, some of them nitpicks, which a human or agent must adjudicate. That trade is worth paying for rare, high-asymmetric-cost decisions and *not* for routine work. It buys **variance-elimination** — you stop gambling on which single model you happened to ask; you get top-of-panel recall without needing to know in advance which model is strong for this task.

That is the honest value. Here is what it is **not**: it is **not** an accuracy improvement, and it is **not** a bug-catching improvement.

> **Our load-bearing negative finding.** A round-2 validation on SWE-bench-Verified defect tasks (N=29) **falsified** the "consensus catches more bugs" hypothesis. A non-Anthropic baseline (GPT-4o) missed 29 of 30 real bugs; running a cross-family council on those 29 produced **no measurable net uplift in catch rate** over simply re-running the agent — the council occasionally caught a miss, but false-positive flags netted it out (effect +0.12, confidence interval crossing zero).
>
> The precise, honest claim is therefore **no net uplift** — *not* "catches no more bugs," which would over-claim in the other direction (our own consensus review caught that overreach). We do not, anywhere, claim the council catches more bugs.

A second finding points the same way: across a 5-domain benchmark, the council **tied the best single model on clean accuracy and beat it in no domain.** On clean, well-trodden tasks a strong single model already saturates; the council matches it, at higher cost. The winner *shifts* by domain — which is exactly the case for variance-elimination, and exactly *not* a case for "more accurate."

**Where consensus fails (named, from our own observation and the literature):**

- **Lossy synthesis.** The reconciler can drop a real finding a single member actually had — we have *observed* the merged answer being weaker than one member's own answer. If you cannot afford a lost finding, preserve per-model content (a mode that surfaces every answer) rather than merging.
- **Correlated failures / shared hallucinations.** Frontier models share heavily overlapping training data. On a shared blind spot — post-cutoff facts, niche domains — they agree *and are uniformly wrong*, and you get a confident wrong answer with a clean "no disagreements" report. **Agreement measures agreement, not truth.** The lever against this is grounding, not more models.
- **False consensus.** Apparent convergence can be an artifact of similar prompting, similar fine-tuning, or one dominant phrasing — not independent corroboration. Treat a unanimous answer on an out-of-distribution fact with the same suspicion you would treat one model's.
- **Specialist overlap.** A non-disjoint judge (also a proposer) scoring its own work inflates the measured agreement — the §6.2 failure, restated as a consensus risk.

**Why consensus ALONE is insufficient.** Strip away grounding and judge-independence and "consensus" reduces to *shared confidence*: a group of correlated systems agreeing from a shared prior, with no check against reality and no independent reconciler. That is the precise configuration in which correlated failure and false consensus do their damage. Consensus earns its place in the discipline only when multiplied by ground truth and adjudicated by an independent judge. By itself it is the weakest of the three mechanisms — and the one most likely to be sold as the whole product.

### 6.4 The ranking, in one line

**Grounding > judge-independence > consensus.** Evidence beats independence beats agreement. A decision process that has all three, in that priority order, is doing Decision Engineering. One that has only the last is doing multi-model marketing.

---

## 7. Why the human stays ultimately accountable

Nothing in this manifesto removes the human from the loop. It *relocates* them — from reviewing every decision by hand (impossible at agent volume) to being the accountable party for the decisions the discipline surfaces as contested, uncertain, or high-stakes. That relocation is deliberate and permanent, for three reasons.

**Verification is not a guarantee.** Everything in §6 reduces single-model error and surfaces disagreement a single model would hide. None of it *guarantees correctness.* Consensus showed no net uplift in catch rate in our own runs; grounding can fail to fit; judges share blind spots with proposers. A decision process is a recall amplifier that *feeds* judgement — it does not replace the party who must answer for the outcome. To treat its output as an auto-trusted merge gate is to mistake a tool for an authority.

**Accountability cannot be delegated to a system that cannot be accountable.** A model cannot be held responsible, cannot be sanctioned, cannot defend a decision under scrutiny, cannot bear the consequence of a wrong call. When a migration drops a column, a clause violates GDPR, or a side-channel ships to production, an organisation answers for it — to a customer, a regulator, a court. That accountability has to land on a human, because accountability is a property persons hold and systems do not. The discipline exists to give that human *better-grounded, better-surfaced, auditable inputs* — not to absorb their responsibility.

**The discipline is designed to keep them in.** This is why principle 7 (expose uncertainty), principle 8 (auditability), and the Human Accountability design principle are not optional. A well-engineered decision process makes the contested part of a decision *visible* and hands it to the responsible party, with a reconstructable record of how the decision was reached. A badly-engineered one launders a contested decision into a smooth verdict and quietly removes the human's ability to apply judgement at the one point it mattered. The first feeds accountability; the second destroys it while appearing more convenient.

The correct mental model: Decision Engineering raises the floor and surfaces the risk; the human owns the decision. The discipline's job is to make sure that when the human owns it, they own it with the best inputs the configuration can produce — and with a record they can defend.

---

## 8. Council as a reference implementation

A discipline needs a worked example: a system that practices the principles, holds the design principles, ranks the mechanisms honestly, and — most importantly — reports honestly where it fails. **Tokonomix Council is offered as a reference implementation of AI Decision Engineering — the first concrete one of a discipline we are proposing, not an externally settled standard.**

"Reference implementation" is a factual claim, and we mean it as one: Council is a concrete, running system that instantiates every principle in §4 and §5. We do **not** claim it is "the industry standard" — that is a market claim, not ours to assert. There is no external spec, no second implementation, and no outside adoption yet; the principles it rests on are the ones proposed here. It is a reference *because* it practices the discipline in the open, negative findings included, not because of any market position.

How Council instantiates the discipline:

- **Single Responsibility.** Council owns *decisions only* — decision quality, independent review, reasoned consensus, reasoning-verification, grounding, disagreement analysis, judge-independence, decision confidence, auditability. It is explicitly **not** responsible for execution, workflow, scheduling, autonomy, memory, routing, or browser automation. Those are real responsibilities that live in *other* components (execution, for instance, belongs to a separate execution governor). The narrow boundary is the point.
- **Independence.** Proposers answer *in parallel and blind* — no round-table where the lone dissenter caves to the majority — and are selected for cross-family **decorrelation over raw score**, because picking only the top scorers converges on similar models and shrinks the decorrelation that is the whole value. The judge is **disjoint and cross-family by default**, and never grades its own answer.
- **Ground Truth & Evidence First.** Grounding is treated as the largest lever, not a feature: the same context-pack is reused by every proposer *and* the judge; the discipline is "verbatim, complete, never compress-to-fit." The grounding-gate (refuse-to-judge-thin-input, dormant / shadow-first) is the strongest honest expression of evidence-first design.
- **Transparency & Preserve-Disagreement.** Every decision surfaces a blind-spots-and-disagreements section at no extra cost; a dedicated mode preserves per-model content so a real finding is not lost to synthesis. The split *is* the signal, and the system shows it.
- **Auditability, Reproducibility, Traceability.** Every call returns the proposer models, the judge model, the cost, and a stable `request_id`, so a decision-of-record can be reconstructed — with the explicit caveat that the default configuration drifts over time, so the record must be pinned to a date and configuration.
- **Human Accountability.** Council is documented throughout as a recall amplifier that *feeds* judgement, never an auto-trust gate. Its own README leads with the negative findings and a "when consensus does NOT help / can hurt" section — the discipline's principle 10 made into product documentation.
- **Never hide failure modes.** Council's public materials name lossy synthesis, correlated failures, false consensus, and specialist overlap, and foreground the falsified bug-catching hypothesis. The honesty is not a disclaimer bolted to a sales page; it is the credibility.

### The road ahead

Decision Engineering is an *emerging* discipline, and Council is an early reference for it, not a finished monument. The honest roadmap:

- **Ground the grounding-gate in data.** Move the refuse-to-judge-on-thin-input mechanism from dormant / shadow-first to enforcing only once shadow metrics show it does not over-bounce legitimate calls. Evidence before activation — the discipline applied to itself.
- **Publish the benchmarks as artifacts, not claims.** Release the full datasets and harnesses behind the findings in §6 — *including* the falsified bug-catching result — so the method, not the marketing, is the citable artifact. A discipline is defined by reproducible method; we intend to supply it.
- **Build out the companion documentation** as field literature: decision theory, consensus, judge-independence, grounding, failure modes, architecture, benchmark methodology, verification, confidence, bias, recall-vs-precision, auditability — each framed from the discipline, each honest about limits.
- **Invite contradiction.** The fastest way to mature a discipline is for others to test its claims and publish where they break — including where they break *us*. A field that only publishes its wins is not a field. We would rather be corrected in the open than be unfalsifiable.

---

## Closing

The thesis of this manifesto is narrow and, we think, hard to argue with once stated: as autonomous systems move from producing answers to *making decisions they act on*, the engineering of the decision process becomes a discipline in its own right — distinct from the engineering of the model, and not solvable by the model alone, because a system cannot independently verify itself.

The mechanisms of that discipline are real but unequal, and honesty about the ranking is the whole game. Grounding beats independence beats consensus. Evidence beats agreement. The most attractive claim — "more models, more accuracy, more bugs caught" — is the one our own data falsified, and we keep that finding in the foreground because a discipline that hides its negative results is not engineering.

And underneath all of it, a human stays accountable — better-equipped, better-grounded, handed the contested decision with a record they can defend, but never replaced. Decision Engineering does not remove human judgement from important decisions. It is the discipline of making sure that when judgement is applied, it is applied to the right thing, with the best inputs the configuration can produce, on a decision anyone can later reconstruct.

That is the field. Council is one honest reference implementation of it. The invitation of this document is for others to build more — and to publish, in the open, exactly where they work and exactly where they do not.

---

*The Decision Engineering Manifesto — Tokonomix Council, 2026. Maintained by InterIP Networks. Released under the same terms as the Council reference implementation (MIT). Corrections, contradictions, and reproductions of our benchmarks are welcome — especially the ones that prove us wrong.*
