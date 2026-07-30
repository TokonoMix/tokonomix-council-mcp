# Discoverability notes

> Part of the [Council MCP](../README.md) documentation suite. This is an internal
> note, not user-facing copy. It records the **proposed** GitHub repository
> description and topics, and the keyword strategy for the docs. Proposals here are
> **not applied** — applying the GitHub description/topics is a manual repo-settings
> change for a maintainer to make.

---

## 1. Proposed GitHub repository description (not applied)

A one-line "About" for the repo. Keep it factual — it is a description, not a claim.

> **Council MCP — an open reference implementation of AI Decision Engineering.
> Independent multi-model review reconciled by an independent judge, grounded in the
> real artifact, for higher-quality, auditable AI decisions. MCP server for Claude
> Code, Cursor, Cline, Continue, and Zed.**

Shorter alternative (for the GitHub 350-char limit, if the above is trimmed):

> **An open reference implementation of AI Decision Engineering: independent
> multi-model review + an independent judge + grounding → auditable AI decisions.
> MCP server.**

## 2. Proposed GitHub topics (not applied)

GitHub topics are lowercase, hyphenated, ≤35 chars, max 20. Proposed set, ordered by
relevance — all describe what the project *is*, none are aspirational:

```
mcp · model-context-protocol · ai-decision-engineering · decision-engineering ·
ai-review · multi-model · llm-judge · ai-verification · consensus · ensemble-reasoning ·
reasoning-validation · ai-governance · independent-review · llm · ai-agents ·
claude · gpt · gemini · eu-ai · grounding
```

## 3. Keyword strategy (applied in the docs, naturally)

The spec's discoverability list — *AI review, multi-model review, decision
engineering, consensus AI, LLM judge, AI verification, ensemble reasoning, reasoning
validation, AI governance, independent AI review* — is woven into the README and doc
headings **where it reads naturally**, never stuffed. Principles followed:

- **One canonical term per concept** (consistency aids both SEO and AI parsing). The
  [Glossary](./glossary.md) is the single source of vocabulary; every doc uses the
  same words for the same ideas.
- **Keywords land on real headings and first sentences**, not in keyword lists. E.g.
  "independent multi-model review", "an independent judge (LLM-as-judge, done
  right)", "AI verification layer", "grounding".
- **Honest framing is itself discoverable.** "No net uplift," "variance-elimination,
  not more accurate," and the named failure modes are distinctive, searchable, and
  credible — they differentiate the project precisely because most marketing avoids
  them.
- **No forbidden patterns.** No invented competitors, no fabricated "$X/1M" figures,
  no claims the benchmarks do not support (see
  [Benchmark Methodology](./benchmark-methodology.md)).

## 4. AI-parseability (machine discoverability)

For agents and crawlers that read the repo as data, not prose:

- **Consistent terminology + a glossary** so a model can resolve a term to one
  definition (the [Glossary](./glossary.md)).
- **`<title>` and `<desc>` on every diagram** ([`diagrams/`](./diagrams/)) so the SVGs
  carry their meaning in text, not only pixels.
- **A docs index in the README** linking every companion doc, so the structure is
  walkable from the entry point.
- **Exact tool names and parameters** documented against the real server
  (`mcp-server/src/index.ts`), so an agent reading the docs calls the tools
  correctly.
- The server also serves a canonical usage skill (`tokonomix_get_skill` /
  `tokonomix_skill_version`) that tells an agent *when* to reach for consensus.

## 5. What is deliberately NOT done here

- The GitHub description and topics above are **proposals**; this run does not change
  repo settings.
- No external link-building, no submission to third-party directories — out of scope.
- No keyword stuffing or doorway pages; the docs must read as serious technical
  writing first.
