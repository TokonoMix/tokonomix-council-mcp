# Changelog — tokonomix-consensus skill

Machine-readable source for the in-conversation update notice. The server (`/api/v1/skill`) parses the **latest** entry below and exposes it as `semver` / `released` / `changes`; the MCP server shows it as "you received a new Tokonomix update v<old> → v<new> (released <date>): <changes>" when it detects a version change.

Format: one `## <semver> — <YYYY-MM-DD>` heading per release, followed by `- <type>: <summary>` bullets (`secfix`, `improvement`, `fix`, `docs`).

## 1.8.2 — 2026-06-30

- fix: **restored proactive suggestion** — the skill stopped offering a consensus check on its own initiative and only fired on an explicit user request. The "When to use" section regained an explicit, bounded directive: at the high-stakes moments (anything irreversible or customer-facing — DB migration, security-relevant change, legal/compliance or customer-facing statement) **propose a cross-model check even when the user did not ask**, offer once, don't nag, skip routine/reversible work, respect cost. Honest framing kept (surfaces disagreement, does **not** guarantee correctness). Mirrored into the `tokonomix_consensus_ask` tool description and the skill `description` (the auto-trigger surface).
- secfix: removed compliance/sovereignty overclaims from the `tokonomix_list_models` tool descriptions — EU is framed as **data-residency routing** (a transatlantic-transfer hedge, not a GDPR/compliance guarantee) and `origin_country` as plain origin-country filtering, replacing "EU-compliance routing" / "GDPR-strict routing" / "sovereignty-aware routing", per the positioning-claim guardrails. Published in npm 1.8.5.

## 1.8.1 — 2026-06-29

- docs: new **"When the council asks back (`needs_context`)"** subsection — teaches agents to respond to a `{status:"needs_context", request_id, missing, delivery_hint}` refusal: the council did not run and you were not charged, so supply the `missing` artefacts verbatim (inline, or via `tokonomix_upload` for large ones) and re-call with the same prompt under `request_id` (cap = one wedervraag). `acknowledge_ungrounded` + `reason` forces a best-effort `grounding:insufficient` verdict for genuinely artefact-less prompts only.
- improvement: `tokonomix_consensus_ask` gains optional `request_id` (continuation), `acknowledge_ungrounded` and `acknowledge_reason` params — forwarded to the gateway, only meaningful when the server returns `needs_context` (forward-compatible; the grounding gate ships dormant behind a flag).
- fix: the MCP tool output is now **English**. The feedback-invite render (the "Feedback requested / YOUR HUMAN / STEP A-C" block the agent reads on every call) and the full-mode judge headings (`### Reasoning` / `### Conclusion`) were Dutch in prior versions — public-facing copy in the package must be English.

## 1.8.0 — 2026-06-29

- improvement: new canonical **"Picking a mode"** section — agents were over-defaulting to `diff` because the tool copy called it "the most valuable mode / best recall" and told them to "prefer diff". Modes are now framed as an intent-based decision with **no universally best one**: `consensus` (a decision you'll act on), `diff` (a disagreement map *you* adjudicate — the judge compares, it does not decide), `raw` (the spread, no judge), `best_of` (the single strongest), `full` (everything + a verdict). The duplicate mode descriptions and the "prefer diff" rule of thumb were consolidated to one source of truth (they had drifted into contradictions).
- secfix: **data-residency default hardened** — "when unsure, default to EU" was unsafe because the API default council is US-hosted; an agent that omitted `hosting_region` silently routed personal data to the US. Now: when unsure, you **must explicitly set `hosting_region=eu`** — do not rely on the default. GDPR trigger cross-references this.
- fix: disambiguated **"call this skill" vs the `consensus` mode** — "Strong signals" is about *whether* to invoke a council, not which mode to pick (agents read "use consensus" as a mode instruction in exactly the high-stakes cases).
- fix: corrected the **`full`-mode cost** — it bills **one** judge pass (per-model reasoning + conclusion in the same pass), not an "extra judge call"; the proposers are the dominant cost in every mode. Added a "use when" clause to `best_of`.
- (Reviewed by a cross-vendor `full` consensus over the draft — Claude + GPT + Gemini, judge Sonnet — which caught the residual contradiction and the residency blind spot.)

## 1.7.9 — 2026-06-27

- improvement: the MCP tool now **renders the `relay_human` block in the tool output you actually read** — the previous renderer dropped it, so the per-round cue to ask your human was invisible even though the skill told you to read it. The "📋 Feedback gevraagd" block now has an ordered `2) JE MENS` section: show the human the council result + cost first, then ask the one question, then relay only what they actually said. Closes the gap where agents reliably self-rated but the human was never asked. (Skill semver re-aligned with the npm package version; 1.7.8 was an npm-only republish with no skill change.)

## 1.7.7 — 2026-06-27

- improvement: the per-round feedback nudge now carries a **`relay_human`** block (`ask`, `choices`, `submit_to`, `rule`) — when you are working with a human, its presence is the explicit cue to ALSO ask the human and relay their verdict on the consensus call (a separate, equally-wanted channel from your own agent rating). The platform sets the cadence from the account's `feedback_frequency` (`ask_every` → every round, `sampled` → occasionally), so you no longer impose your own "once per session" cap. Closes a gap where agents reliably self-rated but the human was never asked.

## 1.7.6 — 2026-06-26

- docs: add a **discipline note** to the "Grounding a review" section — the rule is grounded in a mechanistically convincing case (a char-range invisible in a summary), not a measured effect size; apply it, but do not claim "X% better recall" until confirmed across more calls. Aligns the grounding guidance with the skill's existing no-fabrication stance.

## 1.7.5 — 2026-06-26

- improvement: new **"Grounding a review — send the verbatim artifact"** section. Four rules: (1) send the reviewed artifact (code OR document OR instruction) verbatim and complete, never a summary — the fault lives in the literal details a summary hides; (2) facts maximal, steering minimal — no leading hints, or you can't tell if the model found it or followed your finger; (3) manage the context budget — verbatim for the artifact, interface-level for the surrounding context, scope by relevance; (4) the hard limit is the SMALLEST context window in the panel (judge included) — overflow silently truncates one member into voting blind. Doesn't fit → larger-window panel or split per module, never compress to fit. Framed as a process rule (mechanistic case: a U+2028 char-range was invisible in a summary), not a measured effect.

## 1.7.4 — 2026-06-26

- improvement: the agent's free-text `note` on `tokonomix_rate_consensus` **is now stored** (was discarded). Treated exactly like the human's free text — admin-only, EU-enriched, rolled into a **separate agent-source** day/week/month summary that is **never mixed** with the human-feedback summary, never shown publicly verbatim. Reverses the old "note is never stored" rule; more transparent, same privacy handling.

## 1.7.3 — 2026-06-26

- improvement: the human-feedback relay cadence is now **customer-controlled**. On the human's first review, also ask how often they want to be asked — *every time · occasionally (default) · not again this session · pause for a while* — and respect it (the platform carries the preference; `feedback_invite` surfaces it). Protects the uninterested from fatigue while letting an eager reviewer opt into every round — more feedback when wanted, none forced.

## 1.7.2 — 2026-06-26

- improvement: added **"Relaying your human's feedback (interactive code session)"** — a second, independent channel. When working interactively, occasionally ask your human the 5-choice "what did the council do for you?" question (before revealing your own verdict — no steering) and relay it to `POST /api/v1/consensus/{request_id}/human-feedback`. Sampled, never blocking, relay-only-what-they-said. The platform records a key-relayed human answer as a *relayed* (conservatively-counted) signal, separate from a verified in-app human — by design. Distinct from your own agent rating; both are wanted.

## 1.7.1 — 2026-06-25

- improvement: made the post-call rating prompt **more insistent**. The inline `x_council.feedback_invite` nudge and the two rating sections now open with an explicit "rate this consensus call now — expected next step, not optional housekeeping" framing, since agents were silently skipping the soft prompt and continuing with the user's task.
- docs: the reward copy now names the **real, paid** review reward — sharing the full real/false findings credits the account one model-call back (actual `credit_ledger` credit at the tier per-call rate, once per round, idempotent), which lowers what the round costs and lets the account pass cheaper cross-checked answers on to its own users. Deliberately does NOT promise the dormant Phase-5 feedback reward (which posts no credit).
- fix: **agent rating is independent — no human approval needed.** Removed the "your agent drafts it; the customer approves before submitting" framing that made agents defer (or skip) their own rating waiting for sign-off. Clarified that agent feedback (`source_type='agent'`) and end-user feedback (`source_type='human'`) are two separate, independent stats channels; the agent must submit its own rating itself, and the human can rate the same call separately from the Studio prompt. Neither blocks the other.

## 1.7.0 — 2026-06-25

- improvement: broadened *when to call* — confirming you're on the right route at a decision point is now an explicit, legitimate reason to call (not only resolving doubt); "don't be reluctant to call at decision points". The anti-spam guidance for routine work is unchanged.
- docs: added the load-bearing **"Calling and rating are independent"** rule — call generously, but rate every call on its true value; a confirmation you solicited is still `raised_confidence`, not a catch. Calling more must never become rating higher. The rating-category definitions are unchanged (measurement integrity is preserved).

## 1.6.3 — 2026-06-25

- docs: aligned the skill version label with the running MCP server + npm package (`tokonomix-council-mcp@1.6.3`). The skill content was already current — the `x_council.feedback_invite` surfacing + the `tokonomix_rate_consensus` feedback-loop fields are described as shipped — but the frontmatter `version:` had lagged at 1.5.3, so the self-update notice under-reported. No content/contract change in this bump; it only corrects the version fingerprint clients compare against.

## 1.5.3 — 2026-06-18

- improvement: `tokonomix_rate_consensus` now accepts `consensus_benefit` (feedback-loop, optional) — a structured categorical verdict on whether the council helped: `caught_blind_spot` / `resolved_disagreement` / `raised_confidence` / `no_added_value` / `consensus_was_wrong`. Stored sticky (a score-only re-submit preserves the prior value). Replaces the old discarded free-text note with a privacy-safe signal the platform can aggregate.

## 1.5.1 — 2026-06-16

- docs: recalibrated the security-review benchmark framing to what the data actually says — the cheapest single model (Haiku) matched the council on this set with fewer false positives and one call vs ~four; lead with the per-bug single-model *variance* (you don't know which to trust), not a cherry-picked "missed 42%"; added a model-call cost column; labeled false positives as flag-level (not comparable to snippet-level recall); strengthened the small-N / best-case-dataset / single-grader caveats; "5 of 12" not a percentage
- docs: softened judge independence from "always" to "by default" (it's the default + self-scoring exclusion, not a hard server invariant — pin a cross-family judge); diff-mode example for the migration safety check; illustrative vision slugs (query list_models); fixed the issues URL to the canonical repo; added the tokonomix_rate_consensus tool row

## 1.5.0 — 2026-06-16

- improvement: `tokonomix_get_balance` now reports month-to-date **token throughput** (`month_to_date.tokens`, successful proposer + judge calls only) alongside € spend + calls, so a token-budgeted run can gate on throughput, not only cost — Budget-awareness section updated to track BOTH ceilings and degrade at whichever is reached first
- docs: intro now states up front that the **judge is itself drawn from the multi-vendor pool and is always a different model than the proposers** it scores (never self-judging), so the synthesis step doesn't inherit one vendor's blind spot — plus the option to pin the judge or run a multi-judge panel
- docs: new budget bullet — **per-key guardrails**: a key carries its own predefined default model + council/route and a gateway-enforced monthly spend cap (`monthly_limit_cents`), plus allowed-models/modes/judges/regions/origin-country restrictions, so budget + routing are fixed once on the key

## 1.4.0 — 2026-06-16

- improvement: new "Caching & context-pack" section — prompt caching passes through (Anthropic cache_control on /api/anthropic; OpenAI auto-caching honoured), and a grounded council reuses ONE shared context-pack across all proposers + judge (paid once, not per model)
- fix: removed the "keep ANTHROPIC_API_KEY pointed straight at Anthropic" steer — caching works through the gateway, so you no longer need to bypass Tokonomix to keep it
- docs: context-pack grounding described honestly as server/account-gated (available-when-on, not a universal default)

## 1.3.0 — 2026-06-10

- improvement: image input (vision) support in tokonomix_consensus_ask and tokonomix_single_ask — pass images as {data, media_type} objects; council auto-selects a default vision panel when no models specified
- improvement: client-side validation of images before network call — count (≤8), per-image size (≤5 MB decoded), total size (≤20 MB), media_type whitelist, data-URL prefix detection with clear error messages
- docs: vision-council section in SKILL.md and README — parameters, constraints, default vision panel, worked example

## 1.2.0 — 2026-06-07

- improvement: new "How the council is built — why this is more than voting" section — parallel+blind proposers (dissent preserved, no debate capitulation, cf. Xiong et al. 2025), independent judge (disjoint from proposers, never scores own proposal), decorrelation-over-raw-score selection, empirical guarded model selection (votes = low-weight preference signal, anti-Goodhart, exploration, shadow-mode)
- improvement: consensus reframed as a recall amplifier that feeds human judgment (recall up / precision down trade), not a truth oracle or blind merge gate
- improvement: grounding called out as the biggest lever against shared hallucination
- improvement: elaborated modes + "Choosing a mode" table — diff elevated as the discovery mode (preserves the lone dissenter); consensus noted to average dissent away
- docs: pre-empts common reviewer critiques (correlated errors, judge bias, false alarms, self-judging) with explicit honest framing

## 1.1.1 — 2026-06-06

- chore: clean package — internal review docs no longer ship in the npm tarball (supersedes 1.1.0, unpublished)
- improvement: honest epistemics — consensus now framed as "reduces single-model error + surfaces disagreement", not a correctness guarantee
- improvement: budget-awareness + degradation ladder (consensus → single_ask → host model → flag unverified) with error→rung mapping
- improvement: reproducibility — record proposer models + judge + charged_credits for decisions of record
- improvement: cross-vendor USP and strongest trigger phrases pulled into the description; multilingual trigger list
- improvement: leaner agent-runtime doc — operator setup moved to SETUP.md
- improvement: skill self-update now surfaces a version/date/changelog notice to the user
- fix: `bytes` reported true UTF-8 length (was JS char count)
- docs: data-residency default for personal data (EU council) and slug-drift caveat (from 1.0.x)

## 1.0.0 — 2026-06-02

- improvement: initial published skill — consensus / single_ask / list_models / balance / onboarding / self-update
