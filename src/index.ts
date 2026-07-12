#!/usr/bin/env node
/**
 * tokonomix-council-mcp — Model Context Protocol server for Tokonomix.ai.
 *
 * Exposes tools to any MCP-compatible client (Claude Code, Cursor, Cline,
 * Continue, Zed):
 *
 *   tokonomix_consensus_ask   — multi-model consensus call (2-6 models, judge
 *                               synthesizes one answer)
 *   tokonomix_single_ask      — single-model passthrough, OpenAI-compat shape
 *   tokonomix_list_models     — model catalog with capability + region filter
 *   tokonomix_get_balance     — remaining credit on the account
 *   tokonomix_onboard         — keyless first-run: send OTP to email (step 1)
 *   tokonomix_onboard_verify  — verify OTP, provision account, persist key (step 2)
 *
 * Configuration (env vars):
 *
 *   TOKONOMIX_API_KEY        — optional if you haven't onboarded yet. Bearer token
 *                              starting with `tok_live_`. After running
 *                              tokonomix_onboard_verify the key is saved to
 *                              ~/.tokonomix/credentials.json and loaded automatically.
 *   TOKONOMIX_BASE_URL       — optional. Defaults to https://tokonomix.ai/api/v1.
 *                              Must be https://; a self-hosted origin other than
 *                              tokonomix.ai is allowed (warned about, never blocked)
 *                              — see base-url-guard.ts.
 *   TOKONOMIX_SITE_URL       — optional. Main-app origin for onboard endpoints.
 *                              Defaults to base-URL with /api/v1 stripped, or
 *                              https://tokonomix.ai if the base URL is fully custom.
 *                              Same https-only/guard rules as TOKONOMIX_BASE_URL.
 *   TOKONOMIX_ALLOW_LOCAL    — optional, "1" to opt in. Without it, a loopback/
 *                              private-network/cloud-metadata BASE_URL or SITE_URL
 *                              host is refused at startup (defense-in-depth).
 *   TOKONOMIX_SKILL_PIN      — optional. Set to "bundled" to pin the guiding
 *                              skill to the copy shipped in this package: no skill
 *                              network call, no server-supplied update-notice —
 *                              reproducible, vendor-independent behaviour. Default
 *                              (unset) is server-canonical: the skill is fetched
 *                              from the gateway so fixes reach every agent. The
 *                              active source is shown on each response trailer.
 *
 * Distribution: `npx tokonomix-council-mcp` from any MCP-enabled tool. Example
 * `.mcp.json` (Claude Code):
 *
 *   {
 *     "mcpServers": {
 *       "tokonomix": {
 *         "command": "npx",
 *         "args": ["-y", "tokonomix-council-mcp"],
 *         "env": { "TOKONOMIX_API_KEY": "tok_live_..." }
 *       }
 *     }
 *   }
 *
 *   For first-time users (no key yet): omit TOKONOMIX_API_KEY entirely and call
 *   tokonomix_onboard followed by tokonomix_onboard_verify inside the client.
 */


import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { VERSION } from './version.js';
import {
  type CredentialsFile,
  CREDENTIALS_FILE,
  readCredentialsFile,
  writeCredentialsFile,
  resolveApiKey,
} from './credentials.js';
import { BASE_URL, authHeaders, tokonomixFetch, siteFetch } from './http.js';
import { buildConsensusBody, buildSingleBody } from './request-builders.js';
import { ensureStartupSkillCheck, getSkill, skillVersionTrailer } from './skill.js';
import { validateAndConvertImages, buildUserContent } from './image-validation.js';
import {
  renderFeedbackInvite,
  renderCouncilVerdict,
  renderProposerBreakdown,
  renderSkipped,
  maxTokensAdvisory,
  type FeedbackInvite,
  type CouncilVerdictBlock,
  type ProposerResult,
} from './render.js';
import { runFullMode } from './full-mode.js';
import { buildHumanFeedbackBody } from './human-feedback.js';
import { TOOLS } from './tools.js';

// Startup: no longer fatal if the key is absent. New users run tokonomix_onboard first.
{
  const startupKey = resolveApiKey();
  if (!startupKey) {
    console.error('[tokonomix-council-mcp] No TOKONOMIX_API_KEY set and no credentials file found.');
    console.error('[tokonomix-council-mcp] Call tokonomix_onboard to create a free account and get a key.');
  }
}

// ─── MCP server ──────────────────────────────────────────────────────────────

const server = new Server(
  { name: 'tokonomix-council-mcp', version: VERSION },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

// ─── Tool handlers ───────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  const a = (args ?? {}) as Record<string, unknown>;

  // First tool call of the session: refresh the skill fingerprint from the
  // server (cheap, no billing) so the trailer is accurate and an update notice
  // can fire. Non-fatal on failure.
  await ensureStartupSkillCheck();

  try {
    if (name === 'tokonomix_consensus_ask') {
      const prompt = String(a.prompt ?? '');
      if (!prompt) throw new Error('prompt is required');
      const requestedMode = typeof a.mode === 'string' ? a.mode : 'consensus';

      // ── mode:"full" is a client-side composition (Option A in SPEC-…full-mode):
      //    1) raw call to harvest proposer content per model
      //    2) single-model call against `judge_model` with an explicit
      //       per-proposer agree/disagree synthesis prompt
      //    3) combine into the spec'd response shape
      // The backend itself doesn't know about "full" — we only ever issue
      // backend-supported modes (`raw` + raw single-model).
      if (requestedMode === 'full') {
        return await runFullMode(a);
      }

      // Validate and convert images (throws ImageValidationError on bad input).
      const imageParts = validateAndConvertImages(a.images);
      const userContent = buildUserContent(prompt, imageParts);

      // When images are present, force stream:false (already the default for the
      // MCP server — the gateway contract: non-streaming only for vision calls).
      // stream is never set on the body here, which is correct.

      // Body assembly lives in request-builders.ts (pure, unit-tested — see
      // review 4.6). Only `model`, `messages`, optional `x_council`, optional
      // `max_tokens` ever go on the wire (transparency property, SECURITY.md §3).
      const body = buildConsensusBody(a, userContent);

      const result = await tokonomixFetch('/chat/completions', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });

      const r = result as {
        choices: Array<{ message: { content: string } }>;
        usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
        x_council: {
          mode: string;
          per_model: ProposerResult[];
          charged_credits: number;
          synth: { fallback_to_raw: boolean };
          request_id?: string;
          // Members that did NOT participate (non-vision, timed-out, truncated).
          skipped?: unknown;
          feedback_invite?: FeedbackInvite | null;
          // consensus-integrity #03: present only when the gateway flag is ON.
          verdict?: CouncilVerdictBlock | null;
        };
      };

      // cost_micros is each proposer's RAW provider cost-of-goods (pre-markup),
      // NOT what you are charged. 1 cent = 10_000 micros (see lib/api/providers
      // /cost.ts centsToMicros). The actual charge is `charged_credits`, which
      // stacks all proposers + the judge and applies the platform markup, so the
      // per-proposer numbers below will NOT sum to charged_credits.
      const breakdown = renderProposerBreakdown(r.x_council.per_model);

      // review 4.10: surface members that dropped out (participation honesty) and
      // warn when max_tokens is beyond the judge's synthesis cap (silent-truncation).
      const skippedText = renderSkipped(r.x_council.skipped);
      const truncationWarning = maxTokensAdvisory(a.max_tokens);

      const inviteText = renderFeedbackInvite(
        r.x_council.feedback_invite,
        `${r.x_council.charged_credits} cents`,
      );

      // consensus-integrity #03: DORMANT — empty string unless the gateway flag
      // `council_structured_verdict` is on and sent a verdict block.
      const verdictText = renderCouncilVerdict(r.x_council.verdict);

      return {
        content: [
          {
            type: 'text',
            text: r.choices[0]?.message?.content ?? '(no content)',
          },
          {
            type: 'text',
            text: `\n---\nCharged: ${r.x_council.charged_credits} cents · Mode: ${r.x_council.mode}${r.x_council.request_id ? ` · request_id: ${r.x_council.request_id}` : ''} · Proposers (provider cost, pre-markup, not charged):\n${breakdown}${skippedText}${truncationWarning}${inviteText}${verdictText}`,
          },
          skillVersionTrailer(),
        ],
      };
    }

    if (name === 'tokonomix_single_ask') {
      const prompt = String(a.prompt ?? '');
      if (!prompt) throw new Error('prompt is required');
      const model = typeof a.model === 'string' && a.model ? a.model : 'default';

      // Validate and convert images (throws ImageValidationError on bad input).
      const imageParts = validateAndConvertImages(a.images);
      const userContent = buildUserContent(prompt, imageParts);

      const body = buildSingleBody(a, userContent, model);

      const result = await tokonomixFetch('/chat/completions', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });

      const r = result as {
        model: string;
        choices: Array<{ message: { content: string } }>;
        usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
        x_council: { charged_credits: number };
      };

      return {
        content: [
          { type: 'text', text: r.choices[0]?.message?.content ?? '(no content)' },
          { type: 'text', text: `\n---\nModel: ${r.model} · Charged: ${r.x_council.charged_credits} cents · Tokens: ${r.usage.total_tokens}` },
          skillVersionTrailer(),
        ],
      };
    }

    if (name === 'tokonomix_list_models') {
      const params = new URLSearchParams();
      if (typeof a.hosting_region === 'string') params.set('hosting_region', a.hosting_region);
      if (typeof a.provider === 'string') params.set('provider', a.provider);
      if (typeof a.tier === 'string') params.set('tier', a.tier);
      if (Array.isArray(a.supports) && a.supports.length > 0) {
        params.set('supports', a.supports.map(String).join(','));
      }
      if (typeof a.limit === 'number') params.set('limit', String(a.limit));
      if (typeof a.origin_country === 'string') params.set('origin_country', a.origin_country);

      const result = await tokonomixFetch(`/models?${params.toString()}`, {
        method: 'GET',
        headers: authHeaders(),
      });

      const r = result as { data: Array<{ id: string; owned_by: string; hosting_region: string; origin_country: string | null; context_window: number | null; input_per_1m_cents: number | null; output_per_1m_cents: number | null; capabilities: Record<string, unknown>; tier: string | null }> };

      const lines = r.data.map((m) => {
        const caps = Object.entries(m.capabilities)
          .filter(([, v]) => v === true)
          .map(([k]) => k)
          .join(',');
        return `${m.id}\t${m.hosting_region ?? '?'}\t${m.origin_country ?? '?'}\t${m.tier ?? '?'}\t${m.input_per_1m_cents}/${m.output_per_1m_cents}c per 1M\t[${caps}]`;
      });

      return {
        content: [
          { type: 'text', text: `${r.data.length} models matched.\n\n` + lines.join('\n') },
          skillVersionTrailer(),
        ],
      };
    }

    if (name === 'tokonomix_get_balance') {
      // GET /v1/balance — live credit balance + month-to-date usage.
      // Cached server-side (Cache-Control: private, max-age=30) so repeated
      // calls within a loop don't hammer the credit_ledger SUM query.
      const result = await tokonomixFetch('/balance', {
        method: 'GET',
        headers: authHeaders(),
      });
      const r = result as {
        balance_cents: number;
        balance_eur: string;
        tier: string;
        status: string;
        low_balance: boolean;
        low_balance_threshold_cents: number;
        as_of: string;
        month_to_date: {
          spend_cents: number;
          calls: number;
          tokens?: number;
          by_mode: Record<string, { calls: number; cents: number }>;
          first_call_at: string | null;
          last_call_at: string | null;
        };
      };

      const modeBreakdown = Object.entries(r.month_to_date.by_mode)
        .map(([m, v]) => `  ${m}: ${v.calls} calls / €${(v.cents / 100).toFixed(2)}`)
        .join('\n') || '  (no calls yet this month)';

      const lowBalanceWarning = r.low_balance
        ? `\n\n⚠️  LOW BALANCE — under €${(r.low_balance_threshold_cents / 100).toFixed(2)}. ` +
          `Consider switching to cheaper models (tokonomix_list_models?tier=A) or topping up at https://tokonomix.ai/dashboard.`
        : '';

      return {
        content: [
          {
            type: 'text',
            text:
              `Balance: ${r.balance_eur} (${r.balance_cents} cents) · Tier: ${r.tier} · Status: ${r.status}\n` +
              `Month-to-date: €${(r.month_to_date.spend_cents / 100).toFixed(2)} across ${r.month_to_date.calls} calls` +
              `${r.month_to_date.tokens != null ? ` · ${r.month_to_date.tokens.toLocaleString('en-US')} tokens` : ''}\n` +
              `Per mode:\n${modeBreakdown}\n` +
              `As of: ${r.as_of}` +
              lowBalanceWarning,
          },
          skillVersionTrailer(),
        ],
      };
    }

    if (name === 'tokonomix_skill_version') {
      const s = await getSkill(false);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                version: s.version,
                semver: s.semver,
                released: s.released,
                changes: s.changes,
                sha256: s.sha256,
                last_changed: s.lastChanged,
                bytes: s.bytes,
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    if (name === 'tokonomix_get_skill') {
      const s = await getSkill(true);
      return {
        content: [
          { type: 'text', text: s.content },
          {
            type: 'text',
            text: `\n_skill_version=${s.version}${s.semver ? ` · v${s.semver}` : ''}${s.released ? ` · released ${s.released}` : ''} · last_changed=${s.lastChanged} · bytes=${s.bytes}`,
          },
        ],
      };
    }

    if (name === 'tokonomix_onboard') {
      const email = typeof a.email === 'string' ? a.email.trim() : '';
      if (!email) throw new Error('email is required');
      const body: Record<string, unknown> = { email };
      if (typeof a.name === 'string' && a.name.trim()) body.name = a.name.trim();
      if (typeof a.locale === 'string' && a.locale.trim()) body.locale = a.locale.trim();
      // Beta-gate acceptance: the server refuses to send a code (400) unless the
      // user accepted the beta terms. Only forwarded when the caller passed true
      // (after confirming with their human) — never defaulted on.
      if (a.accept_beta_terms === true) body.accept_beta_terms = true;

      // siteFetch throws on non-2xx; any HTTP error (400 disposable, 429 rate-limit,
      // 400 beta-terms-required) surfaces here with the server's agent-readable message.
      await siteFetch('/api/onboard/start', body);

      return {
        content: [
          {
            type: 'text',
            text:
              `If ${email} is a NEW address, a 6-digit verification code has been emailed.\n\n` +
              `Check your inbox (and spam folder) and call **tokonomix_onboard_verify** with:\n` +
              `  - email: "${email}"\n` +
              `  - code: "<the 6-digit code from the email>"\n\n` +
              `The code is valid for 10 minutes. If it doesn't arrive, call tokonomix_onboard again to request a new one.\n\n` +
              `⚠️ If you ALREADY have a Tokonomix account, NO code will arrive (the address is already verified) — ` +
              `that is expected, not a failure. Instead, get your API key at https://tokonomix.ai/dashboard/keys and ` +
              `set TOKONOMIX_API_KEY (no need to call tokonomix_onboard_verify).`,
          },
        ],
      };
    }

    if (name === 'tokonomix_onboard_verify') {
      const email = typeof a.email === 'string' ? a.email.trim() : '';
      const code = typeof a.code === 'string' ? a.code.trim() : '';
      if (!email) throw new Error('email is required');
      if (!code) throw new Error('code is required');

      const result = await siteFetch('/api/onboard/verify', { email, code });

      // Map response fields (route returns apiKey.rawKey + account.accountId).
      const apiKeyObj = result.apiKey as Record<string, unknown> | undefined;
      const accountObj = result.account as Record<string, unknown> | undefined;
      const creditsObj = result.credits as Record<string, unknown> | undefined;
      const loginObj = result.login as Record<string, unknown> | undefined;

      const rawKey = typeof apiKeyObj?.rawKey === 'string' ? apiKeyObj.rawKey : null;
      const accountId = typeof accountObj?.accountId === 'string' ? accountObj.accountId : undefined;
      const creditsEur = typeof creditsObj?.eur === 'string' ? creditsObj.eur : '0.00';
      const approxCalls = typeof creditsObj?.approxCalls === 'number' ? creditsObj.approxCalls : 0;
      const dashboardUrl = typeof loginObj?.dashboardUrl === 'string' ? loginObj.dashboardUrl : 'https://tokonomix.ai/en/dashboard';
      const setPasswordUrl = typeof loginObj?.setPasswordUrl === 'string' ? loginObj.setPasswordUrl : dashboardUrl;

      if (!rawKey) {
        throw new Error('Onboard verify succeeded but no API key was returned. Contact support.');
      }

      // Persist the key to ~/.tokonomix/credentials.json (dir 0700, file 0600).
      const alreadyExists = readCredentialsFile() !== null;
      const creds: CredentialsFile = {
        api_key: rawKey,
        ...(accountId ? { account_id: accountId } : {}),
        created_at: new Date().toISOString(),
      };
      writeCredentialsFile(creds);

      const overwriteNote = alreadyExists
        ? '\n\n> Note: A previous credentials file existed and has been overwritten with your new key.'
        : '';

      return {
        content: [
          {
            type: 'text',
            text:
              `Account created successfully!\n\n` +
              `**Email:** ${email}\n` +
              `**API Key (save this — shown once):** \`${rawKey}\`\n` +
              `**Free credit:** €${creditsEur} (≈${approxCalls} consensus calls)\n\n` +
              `The key has been saved to \`${CREDENTIALS_FILE}\` — all tokonomix_* tools will now work automatically in this MCP server.\n\n` +
              `**Set a dashboard password (optional):** use "Forgot password" — we email a reset link: ${setPasswordUrl}\n` +
              `**Dashboard:** ${dashboardUrl}` +
              overwriteNote,
          },
        ],
      };
    }

    if (name === 'tokonomix_rate_consensus') {
      const requestId = typeof a.request_id === 'string' ? a.request_id.trim() : '';
      if (!requestId) throw new Error('request_id is required');

      const score = typeof a.score === 'number' ? a.score : undefined;
      if (score === undefined || !Number.isInteger(score) || score < 1 || score > 10) {
        throw new Error('score must be an integer between 1 and 10');
      }

      const body: Record<string, unknown> = { score };
      if (typeof a.note === 'string' && a.note.trim()) body.note = a.note.trim();
      if (typeof a.helped_model === 'string' && a.helped_model.trim()) {
        body.helped_model = a.helped_model.trim();
      }
      // Feedback-loop fields (INT-1882): forwarded as-is; the server rejects them
      // (400) when the platform feedback-loop is disabled, and validates the
      // findings counts against the call's real bucket counts when enabled.
      if (typeof a.outcome === 'string' && a.outcome.trim()) {
        body.outcome = a.outcome.trim();
      }
      if (a.findings && typeof a.findings === 'object' && !Array.isArray(a.findings)) {
        body.findings = a.findings;
      }
      if (typeof a.consensus_benefit === 'string' && a.consensus_benefit.trim()) {
        body.consensus_benefit = a.consensus_benefit.trim();
      }

      const result = await tokonomixFetch(`/consensus/${encodeURIComponent(requestId)}/rate`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });

      const r = result as {
        object: string;
        request_id: string;
        score: number;
        helped_model: string | null;
        outcome?: string | null;
        review_reward?: number | null;
        recorded_at: string;
      };

      const helpedLine = r.helped_model ? ` · Blind-spot credit → ${r.helped_model}` : '';
      const outcomeLine = r.outcome ? ` · outcome: ${r.outcome}` : '';
      const rewardLine = typeof r.review_reward === 'number' ? ` · review_reward: ${r.review_reward}` : '';

      return {
        content: [
          {
            type: 'text',
            text:
              `Rating recorded: ${r.score}/10${helpedLine}${outcomeLine}${rewardLine}\n` +
              `request_id: ${r.request_id} · recorded_at: ${r.recorded_at}`,
          },
          skillVersionTrailer(),
        ],
      };
    }

    if (name === 'tokonomix_relay_human_feedback') {
      const { request_id: requestId, body } = buildHumanFeedbackBody(a);

      let result: unknown;
      try {
        result = await tokonomixFetch(`/consensus/${encodeURIComponent(requestId)}/human-feedback`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify(body),
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('Tokonomix API 404')) {
          return {
            content: [
              { type: 'text', text: 'Human feedback relay is not enabled on this platform yet (DORMANT).' },
              skillVersionTrailer(),
            ],
          };
        }
        throw e;
      }

      const r = result as {
        object: string;
        request_id: string;
        state: string;
        consensus_benefit?: string | null;
        recorded_at: string;
      };

      return {
        content: [
          {
            type: 'text',
            text:
              `Human feedback relayed: choice ${body.choice} → ${r.consensus_benefit ?? r.state}\n` +
              `request_id: ${r.request_id} · recorded_at: ${r.recorded_at}`,
          },
          skillVersionTrailer(),
        ],
      };
    }

    if (name === 'tokonomix_upload') {
      const files = Array.isArray(a.files) ? a.files : [];
      if (files.length === 0) throw new Error('files is required (a non-empty array of {content})');

      // 1. Request an ephemeral, region-pinned upload session/key. The gateway is
      //    flag-gated → 404 context_upload_disabled while the feature is dormant.
      let keyResp: unknown;
      try {
        keyResp = await tokonomixFetch('/context/upload-key', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({}),
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('context_upload_disabled')) {
          return {
            content: [
              {
                type: 'text',
                text:
                  'Context upload is not enabled yet (DORMANT). Use context.inline for small ' +
                  'payloads on tokonomix_consensus_ask, or ask the platform to enable uploads.',
              },
              skillVersionTrailer(),
            ],
          };
        }
        throw e;
      }
      const k = keyResp as { session: string; upload_url: string; handle: string; max_bytes: number };

      // 2. Pack the files and PUT them to the presigned URL — OUR region-pinned
      //    bucket (no SSRF: we never fetch a caller URL). Enforce the byte cap.
      const payload = JSON.stringify({
        files: files
          .filter((f): f is Record<string, unknown> => !!f && typeof f === 'object')
          .map((f) => ({
            content: String((f as Record<string, unknown>).content ?? ''),
            path: typeof (f as Record<string, unknown>).path === 'string' ? (f as Record<string, unknown>).path : undefined,
            lang: typeof (f as Record<string, unknown>).lang === 'string' ? (f as Record<string, unknown>).lang : undefined,
            verbatim: (f as Record<string, unknown>).verbatim === true,
          })),
      });
      if (Buffer.byteLength(payload, 'utf8') > k.max_bytes) {
        throw new Error(`upload exceeds the ${k.max_bytes}-byte cap for this key`);
      }
      const putRes = await fetch(k.upload_url, { method: 'PUT', body: payload });
      if (!putRes.ok) throw new Error(`upload failed: HTTP ${putRes.status}`);

      return {
        content: [
          {
            type: 'text',
            text:
              `Staged ${files.length} file(s) in upload session ${k.session}.\n` +
              `Re-ask with context:{session:"${k.session}", handles:["${k.handle}"]} on ` +
              `tokonomix_consensus_ask — all proposers + judges will read the shared pack.`,
          },
          skillVersionTrailer(),
        ],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (err) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
      isError: true,
    };
  }
});

// ─── Bootstrap ───────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Note: MCP servers are silent on stdout (used by the protocol); diagnostic
  // output goes to stderr only.
  console.error(`[tokonomix-council-mcp] connected via stdio · base=${BASE_URL}`);
}

// Guard: only start the MCP server when this file is the entry point, not when
// it is imported by tests or other modules. In Node.js ESM there is no
// require.main; instead we compare import.meta.url to the resolved argv[1].
import { pathToFileURL } from 'node:url';
const _isEntryPoint =
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (_isEntryPoint) {
  main().catch((err) => {
    console.error('[tokonomix-council-mcp] fatal:', err);
    process.exit(1);
  });
}
