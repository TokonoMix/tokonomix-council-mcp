// Tool schema definitions for the MCP tools/list response. Pure data — no
// runtime logic here; the CallToolRequestSchema handler in index.ts dispatches
// on tool.name.

export const TOOLS = [
  {
    name: 'tokonomix_consensus_ask',
    description: [
      'Ask 2-6 frontier LLM proposers (parallel + blind) and reconcile via an independent judge (disjoint from the proposers, never scoring its own answer). A recall amplifier that surfaces disagreement a single model hides — it reduces single-model error but does NOT guarantee correctness (frontier models share training data, so agreement is not proof; ground high-stakes facts). Pick the synthesis mode by what you need from the call — there is no universally best mode; see the `mode` parameter.',
      'Use this when correctness matters more than latency: legal questions, code review, fact-checking, high-stakes reasoning.',
      'Proactively offer it — don\'t wait to be asked — before anything irreversible or with real consequence: a DB migration, a security-relevant change, a legal/compliance statement, a customer-facing commitment. Offer once per decision (a few cents, surfaces disagreement, no correctness guarantee), then act on the user\'s answer; if they decline don\'t re-raise; skip routine or reversible work.',
      'Modes (pick by intent): consensus = one decided answer (default); diff = an agreements/disagreements/confidence map where the judge COMPARES but does NOT decide; raw = all answers, no judge (cheapest); best_of = judge picks the single strongest; full = all answers PLUS the judge\'s per-model reasoning AND a conclusion. You decide which fits.',
      'Tip: leave `models` empty to use the per-key or per-account default council. Use `tokonomix_list_models` to discover available slugs.',
    ].join(' '),
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'The user prompt to send to every proposer.',
        },
        models: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of 2-6 bare model slugs (e.g. "claude-haiku-4-5-20251001", "gpt-5", "gemini-2.5-flash"). Omit to use account/key defaults. Provider-prefixed slugs ("anthropic/claude-...") also accepted for explicit pinning.',
        },
        mode: {
          type: 'string',
          enum: ['consensus', 'diff', 'best_of', 'raw', 'full'],
          description: 'Synthesis mode — pick by what you need; there is no universally best mode. `consensus` (default) = one merged, decided answer (use when you want THE answer; trades dissent away). `diff` = a structured agreements/disagreements/confidence report — the judge COMPARES, it does NOT decide (use when you will adjudicate yourself but want the disagreement mapped). `raw` = every answer verbatim, NO judge, cheapest (use when you want the unfiltered spread and will decide entirely yourself). `best_of` = judge picks the single strongest verbatim answer. `full` = every answer PLUS the judge\'s per-model reasoning AND a conclusion, in one judge pass — not an extra call (use when you want both the raw landscape and a verdict).',
        },
        judge_model: {
          type: 'string',
          description: 'Model slug used by the judge. Omit to use the system default (Claude Haiku).',
        },
        judge_models: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of judge model slugs for multi-judge best_of. When provided, all listed models act as judges and the backend picks the strongest synthesis. Takes precedence over judge_model when both are set.',
        },
        request_id: {
          type: 'string',
          description: 'Continuation id. Omit unless continuing a prior {status:"needs_context"} response: re-call with the SAME request/instructions PLUS the missing artefacts attached (inline or via tokonomix_upload) and this request_id, to run the council on the now-grounded input. Re-calling WITHOUT it is a fresh, chargeable request (not a continuation). Do not combine with acknowledge_ungrounded.',
        },
        acknowledge_ungrounded: {
          type: 'boolean',
          description: 'Set true ONLY when you are submitting a prompt that is intentionally artefact-less — a general question with nothing to attach. Forces a best-effort council verdict flagged grounding:insufficient instead of being asked back for content. If you have or can quote the referenced artefact, attach it instead. Requires acknowledge_reason. Use sparingly; do not combine with request_id.',
        },
        acknowledge_reason: {
          type: 'string',
          description: 'Required with acknowledge_ungrounded: a short reason why the prompt is intentionally artefact-less (e.g. "general question about coding best practices").',
        },
        system: {
          type: 'string',
          description: 'Optional system prompt prepended to the messages array.',
        },
        max_tokens: {
          type: 'integer',
          description: 'Max output tokens per proposer. Default: 1024; clamped to a 16384 ceiling per proposer. The judge/synthesis step is hard-capped at 8192 output tokens regardless of this value, so on large multi-key structured outputs the judge can truncate even when proposers fit — batch keys or split the request rather than raising this past 8192. NOTE: each proposer also has a ~60s wall-clock timeout; a high max_tokens that a slow flagship (large reasoning models) cannot finish within 60s times that proposer out (the call still returns from the proposers that did finish). Keep max_tokens to what the slowest model in your council can emit in ~60s.',
        },
        context: {
          type: 'object',
          description: 'Optional grounding context (INT-1817). Inline files/snippets are sent to ALL proposers AND the judge so the council reasons over the same source instead of guessing. Inline only; large payloads route to upload (not yet available). Server-gated — ignored unless context-upload is enabled on the account.',
          properties: {
            inline: {
              type: 'array',
              description: 'Files or snippets to ground the council on.',
              items: {
                type: 'object',
                properties: {
                  path: { type: 'string', description: 'Optional path/label shown to the models.' },
                  lang: { type: 'string', description: 'Optional language hint for the code fence (e.g. "ts").' },
                  content: { type: 'string', description: 'The verbatim file/snippet content.' },
                },
                required: ['content'],
              },
            },
            github_refs: {
              type: 'array',
              items: { type: 'string' },
              description: 'Public github.com https file URLs to fetch and ground on (server-side, SSRF-allowlisted).',
            },
            session: {
              type: 'string',
              description: 'B08 (escalated): an upload-session id from tokonomix_upload. When set, the council reads the ONE shared context-pack for the session instead of inline. Server-gated; ignored unless context-upload is enabled.',
            },
            handles: {
              type: 'array',
              items: { type: 'string' },
              description: 'B08: opaque handle ids for the staged objects (from tokonomix_upload). Never a URL.',
            },
          },
        },
        images: {
          type: 'array',
          description: [
            'Optional images to include in the user message (vision input). Non-streaming only; the council auto-selects a',
            'default vision panel (claude-fable-5 + gemini-2.5-pro + gpt-4o class) when no models are specified. With an',
            'explicit models list, non-vision models are skipped (reported in x_council.skipped); an explicit single',
            'non-vision model returns 400. Constraints: ≤8 images, ≤5 MB decoded per image, ≤20 MB total. Use',
            'tokonomix_list_models({"supports":["vision"]}) to discover vision-capable slugs.',
          ].join(' '),
          maxItems: 8,
          items: {
            type: 'object',
            properties: {
              data: {
                type: 'string',
                description: 'Raw base64-encoded image data — do NOT include the "data:image/...;base64," prefix. Max ~5 MB decoded.',
              },
              media_type: {
                type: 'string',
                enum: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
                description: 'MIME type of the image.',
              },
            },
            required: ['data', 'media_type'],
          },
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'tokonomix_single_ask',
    description: [
      'Single-model passthrough call. Cheaper than consensus — use for routine reasoning, tool-orchestration, classification.',
      'Returns the model\'s plain answer with markup billing on top.',
      'Tip: use `tokonomix_consensus_ask` instead when correctness matters.',
    ].join(' '),
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'The user prompt to send.',
        },
        model: {
          type: 'string',
          description: 'Bare model slug (e.g. "claude-haiku-4-5-20251001", "gpt-5"), or "default" to use the key/account default. Provider-prefixed slugs ("anthropic/claude-...") also accepted. If omitted, uses "default". Must be a vision-capable model when images are provided.',
        },
        system: {
          type: 'string',
          description: 'Optional system prompt prepended to the messages array.',
        },
        max_tokens: {
          type: 'integer',
          description: 'Max output tokens. Default: 1024; clamped to a 16384 ceiling.',
        },
        images: {
          type: 'array',
          description: [
            'Optional images to include in the user message (vision input). Non-streaming only. Requires a vision-capable model',
            '(use tokonomix_list_models({"supports":["vision"]}) to find one). Constraints: ≤8 images, ≤5 MB decoded per',
            'image, ≤20 MB total across all images.',
          ].join(' '),
          maxItems: 8,
          items: {
            type: 'object',
            properties: {
              data: {
                type: 'string',
                description: 'Raw base64-encoded image data — do NOT include the "data:image/...;base64," prefix. Max ~5 MB decoded.',
              },
              media_type: {
                type: 'string',
                enum: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
                description: 'MIME type of the image.',
              },
            },
            required: ['data', 'media_type'],
          },
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'tokonomix_list_models',
    description: [
      'List the active models reachable through this account.',
      'Filter by hosting region for EU data-residency routing, by provider, by tier, or by capability.',
      'Returns id, owned_by, hosting_region, context_window, input/output price per 1M cents, capabilities (tools, vision, json_schema, prompt_caching, reasoning, audio_input, pdf_input).',
    ].join(' '),
    inputSchema: {
      type: 'object',
      properties: {
        hosting_region: {
          type: 'string',
          enum: ['eu', 'fr', 'us', 'multi'],
          description: '"eu" matches eu OR fr. Use for EU data-residency routing (a hedge against transatlantic transfer — not a full GDPR compliance guarantee).',
        },
        provider: {
          type: 'string',
          description: 'Filter to one provider (anthropic, openai, google, ovh, openrouter).',
        },
        tier: {
          type: 'string',
          enum: ['A', 'B', 'C'],
          description: 'Filter to one model tier.',
        },
        supports: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['tools', 'parallel_tools', 'vision', 'json_schema', 'json_mode', 'prompt_caching', 'audio_input', 'audio_output', 'pdf_input', 'reasoning'],
          },
          description: 'Comma-separated capability list; models must support ALL of these.',
        },
        limit: {
          type: 'integer',
          description: 'Max results. Default 500, max 1000.',
        },
        origin_country: {
          type: 'string',
          description: 'ISO 3166-1 alpha-2 country code of the model\'s origin (e.g. "US", "FR", "DE"). Filters to models whose AI lab is headquartered in that country. Useful for origin-country filtering — e.g. models from EU-headquartered labs.',
        },
      },
    },
  },
  {
    name: 'tokonomix_get_balance',
    description: 'Get the current credit balance and account tier of the authenticated key.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'tokonomix_skill_version',
    description: [
      'Return a cheap version fingerprint of the canonical Tokonomix SKILL.md (the doc that tells you when to use the other tokonomix_* tools).',
      'No network call. Returns {version, sha256, last_changed, bytes}.',
      'Use this to detect that your local cached SKILL.md is stale — if your cached version differs from the returned one, call tokonomix_get_skill to refresh.',
    ].join(' '),
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'tokonomix_get_skill',
    description: [
      'Return the canonical Tokonomix consensus SKILL.md content for this MCP-server version.',
      'Use this on first connection, or when tokonomix_skill_version reports a version newer than your cache.',
      'The skill explains when to reach for consensus (legal, GDPR, code review, fact-check) vs single-model passthrough, plus what modes (consensus, diff, best_of, raw, full) are available right now.',
    ].join(' '),
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'tokonomix_onboard',
    description: [
      'Step 1 of keyless first-run onboarding. Sends a 6-digit OTP to the provided email address.',
      'No API key is required to call this tool — it is the entry point for new users.',
      'After calling this tool, instruct the user to check their email and call tokonomix_onboard_verify with the code.',
      'On success the server returns {ok:true} regardless of whether the email already has an account (enumeration-safe).',
    ].join(' '),
    inputSchema: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          description: 'The user\'s email address. A 6-digit one-time code will be sent here.',
        },
        name: {
          type: 'string',
          description: 'Optional display name for the account (max 200 characters).',
        },
        locale: {
          type: 'string',
          enum: ['en', 'nl', 'de', 'fr', 'es', 'tr'],
          description:
            "Optional UI/email language for the account (the welcome email + dashboard links use it). Pass the user's language if you know it; defaults to English.",
        },
      },
      required: ['email'],
    },
  },
  {
    name: 'tokonomix_onboard_verify',
    description: [
      'Step 2 of keyless first-run onboarding. Verifies the 6-digit OTP from tokonomix_onboard.',
      'No API key is required to call this tool.',
      'On success: provisions a free-tier Tokonomix account, saves the API key to ~/.tokonomix/credentials.json (shown once here — the user must save it), and returns the starting credit balance.',
      'After this call succeeds, all other tokonomix_* tools will work without any env-var configuration.',
    ].join(' '),
    inputSchema: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          description: 'The same email address used in tokonomix_onboard.',
        },
        code: {
          type: 'string',
          description: 'The 6-digit numeric code from the OTP email.',
        },
      },
      required: ['email', 'code'],
    },
  },
  {
    name: 'tokonomix_rate_consensus',
    description: [
      'Rate a consensus call 1–10 on real-world usefulness, after you have seen the answer play out.',
      'The `request_id` is returned by tokonomix_consensus_ask in the billing breakdown line (` · request_id: ...`) and in the `x_council.request_id` metadata field.',
      'Optional: `helped_model` credits the ONE model whose minority or blind-spot view actually helped (the red-thread blind-spot differentiator) — supply its bare slug (e.g. "gemini-2.5-pro"). Opt-in, no friction.',
      'Optional: `note` accepts up to 2000 chars of free text — it IS stored (admin-only, never returned to any caller, never shown publicly verbatim) and enriched by an EU-hosted model into the agent-source day/week/month summary, kept strictly separate from the human-feedback summary. Same privacy handling as the human free text.',
      'Optional feedback (INT-1882, accepted only when the platform feedback-loop is enabled): `outcome` (correct|wrong|partial) is the minimal always-useful signal; `findings` is the rich agent signal — the real/false split per severity bucket {high,medium,low}:{real,false}. The auto-scoring already counts the buckets; you supply only whether each was a TRUE catch or a FALSE positive. Sharing the full findings earns the review-discount once go-live (one model-call less on that round).',
      'Per-account dedup: one authoritative rating per request_id per account; re-submitting updates it (last-write-wins). Requires the same API key that made the original call.',
      'Built DORMANT (INT-1818 Q3): returns 404 until the platform enables the feature.',
    ].join(' '),
    inputSchema: {
      type: 'object',
      properties: {
        request_id: {
          type: 'string',
          description: 'The UUID of the consensus call to rate. Returned by tokonomix_consensus_ask.',
        },
        score: {
          type: 'integer',
          minimum: 1,
          maximum: 10,
          description: 'Usefulness score 1–10 (1 = not useful at all, 10 = extremely useful in practice).',
        },
        note: {
          type: 'string',
          maxLength: 2000,
          description: 'Optional free-text context (max 2000 chars). Accepted for caller convenience but NEVER stored.',
        },
        helped_model: {
          type: 'string',
          maxLength: 200,
          description: 'Optional bare model slug of the one model whose minority view or blind-spot catch actually helped (e.g. "gemini-2.5-pro"). Blind-spot direct credit — opt-in.',
        },
        outcome: {
          type: 'string',
          enum: ['correct', 'wrong', 'partial'],
          description: 'Optional (feedback-loop): did the consensus answer turn out correct, wrong, or partial in practice? The minimal validation signal — upgrades the call to high-confidence scoring.',
        },
        findings: {
          type: 'object',
          description: 'Optional (feedback-loop, agent path): the requester real/false validation per severity bucket. Counts only — never finding text. Each count must not exceed the bucket count the call actually produced.',
          properties: {
            high: { $ref: '#/$defs/bucketFindings' },
            medium: { $ref: '#/$defs/bucketFindings' },
            low: { $ref: '#/$defs/bucketFindings' },
          },
          additionalProperties: false,
        },
        consensus_benefit: {
          type: 'string',
          enum: [
            'caught_blind_spot',
            'resolved_disagreement',
            'raised_confidence',
            'no_added_value',
            'consensus_was_wrong',
          ],
          description: 'Your structured verdict on whether the council helped: caught_blind_spot / resolved_disagreement / raised_confidence / no_added_value / consensus_was_wrong. Replaces the old discarded free-text note with a privacy-safe categorical signal. Optional (feedback-loop, accepted only when the platform feedback-loop is enabled).',
        },
      },
      required: ['request_id', 'score'],
      $defs: {
        bucketFindings: {
          type: 'object',
          properties: {
            real: { type: 'integer', minimum: 0, description: 'How many findings in this bucket were TRUE catches.' },
            false: { type: 'integer', minimum: 0, description: 'How many were FALSE positives (the precision signal).' },
          },
          required: ['real', 'false'],
          additionalProperties: false,
        },
      },
    },
  },
  {
    name: 'tokonomix_upload',
    description: [
      'Stage large context (over the inline cap) for a grounded consensus call (INT-1817 B08).',
      'Returns an ephemeral, region-pinned upload session: a `session` id + opaque `handles`. Pass `context:{session, handles}` to tokonomix_consensus_ask so all proposers + judges read the ONE shared context-pack (build-once, in-region digest).',
      'The staged content is ephemeral (auto-purged after a short retention) and region-pinned (EU by default). NEVER pass a URL — only file contents; the server never fetches a caller URL (no SSRF).',
      'Built DORMANT: returns a clear "not enabled" message until the platform enables context-upload (a later decision). Use inline context.inline for small payloads instead.',
    ].join(' '),
    inputSchema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          description: 'The files/snippets to stage. Each is staged verbatim or digested server-side (the verbatim budget is server-bounded).',
          items: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Optional path/label.' },
              lang: { type: 'string', description: 'Optional language hint.' },
              content: { type: 'string', description: 'The verbatim file/snippet content.' },
              verbatim: { type: 'boolean', description: 'Request verbatim (uncompressed) inclusion; server-bounded — over-budget files are digested.' },
            },
            required: ['content'],
          },
        },
      },
      required: ['files'],
    },
  },
];
