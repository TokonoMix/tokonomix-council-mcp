# Changelog — tokonomix-consensus skill

Machine-readable source for the in-conversation update notice. The server (`/api/v1/skill`) parses the **latest** entry below and exposes it as `semver` / `released` / `changes`; the MCP server shows it as "you received a new Tokonomix update v<old> → v<new> (released <date>): <changes>" when it detects a version change.

Format: one `## <semver> — <YYYY-MM-DD>` heading per release, followed by `- <type>: <summary>` bullets (`secfix`, `improvement`, `fix`, `docs`).

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
