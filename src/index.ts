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
 *   TOKONOMIX_SITE_URL       — optional. Main-app origin for onboard endpoints.
 *                              Defaults to base-URL with /api/v1 stripped, or
 *                              https://tokonomix.ai if the base URL is fully custom.
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
import { readFileSync, statSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';

const BASE_URL = (process.env.TOKONOMIX_BASE_URL ?? 'https://tokonomix.ai/api/v1').replace(/\/$/, '');

// ─── Site origin (main app, NOT /api/v1) ─────────────────────────────────────
// The onboard endpoints (/api/onboard/start and /api/onboard/verify) live on
// the main Next.js app, not the /api/v1 gateway. We derive the site origin by:
//   1. Checking TOKONOMIX_SITE_URL env var (explicit override).
//   2. Stripping /api/v1 from BASE_URL when it ends with that path.
//   3. Falling back to https://tokonomix.ai (the production default).
const SITE_BASE = (
  process.env.TOKONOMIX_SITE_URL
    ? process.env.TOKONOMIX_SITE_URL
    : BASE_URL.endsWith('/api/v1')
      ? BASE_URL.slice(0, -'/api/v1'.length)
      : 'https://tokonomix.ai'
).replace(/\/$/, '');

// ─── Credentials file ─────────────────────────────────────────────────────────
// ~/.tokonomix/credentials.json — written with mode 0600 / dir 0700.
// Shape: { api_key: string, account_id?: string, created_at: string }
const CREDENTIALS_DIR = resolve(homedir(), '.tokonomix');
const CREDENTIALS_FILE = resolve(CREDENTIALS_DIR, 'credentials.json');

interface CredentialsFile {
  api_key: string;
  account_id?: string;
  created_at: string;
}

/** Read the persisted credentials file; returns null if missing or malformed. */
function readCredentialsFile(): CredentialsFile | null {
  try {
    const raw = readFileSync(CREDENTIALS_FILE, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      'api_key' in parsed &&
      typeof (parsed as Record<string, unknown>).api_key === 'string'
    ) {
      return parsed as CredentialsFile;
    }
    return null;
  } catch {
    return null;
  }
}

/** Persist credentials. Creates dir with 0700, file with 0600.
 *  chmod called explicitly after write because mkdirSync/writeFileSync mode
 *  args are masked by the process umask. */
function writeCredentialsFile(creds: CredentialsFile): void {
  mkdirSync(CREDENTIALS_DIR, { recursive: true, mode: 0o700 });
  chmodSync(CREDENTIALS_DIR, 0o700);
  const json = JSON.stringify(creds, null, 2);
  writeFileSync(CREDENTIALS_FILE, json, { encoding: 'utf8', mode: 0o600 });
  chmodSync(CREDENTIALS_FILE, 0o600);
}

// ─── API key resolution (dynamic — re-read on each call so a freshly written
//     credentials file is picked up within the same process lifetime) ──────────

/** Returns the API key: TOKONOMIX_API_KEY env var takes priority, then the
 *  credentials file. Returns null when neither source has a key. */
function resolveApiKey(): string | null {
  const env = process.env.TOKONOMIX_API_KEY;
  if (env && env.trim()) return env.trim();
  const creds = readCredentialsFile();
  return creds?.api_key ?? null;
}

/** Like resolveApiKey() but throws a friendly Error when no key is available.
 *  Called from authHeaders() so every key-gated tool gets the same guidance. */
function requireApiKey(): string {
  const key = resolveApiKey();
  if (!key) {
    throw new Error(
      'No Tokonomix API key found. Run tokonomix_onboard (with your email) to create a free account ' +
      'and obtain a key automatically, then retry this tool. ' +
      'Alternatively, set the TOKONOMIX_API_KEY environment variable.',
    );
  }
  return key;
}

// Startup: no longer fatal if the key is absent. New users run tokonomix_onboard first.
{
  const startupKey = resolveApiKey();
  if (!startupKey) {
    console.error('[tokonomix-council-mcp] No TOKONOMIX_API_KEY set and no credentials file found.');
    console.error('[tokonomix-council-mcp] Call tokonomix_onboard to create a free account and get a key.');
  }
}

// ─── Skill self-update ────────────────────────────────────────────────────────
// Skill self-update is SERVER-CANONICAL over HTTPS, with the bundled SKILL.md
// only as an offline fallback. The MCP runs locally on the agent's host, so a
// bundled-file read would just echo whatever the install shipped — it could
// never reflect a newer server-side skill. Instead we fetch the canonical doc
// from GET {BASE_URL}/skill (public, no key, no billing) so editing the skill
// on the server propagates to every remote agent on its next get_skill():
//   1. tokonomix_skill_version()  — GET /skill?meta=1  (cheap fingerprint)
//   2. tokonomix_get_skill()      — GET /skill         (full canonical content)
// Bundled copy is used only when the HTTPS fetch fails (offline / server down).

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_MD_PATH = resolve(__dirname, '../skill/tokonomix-consensus/SKILL.md');
const CHANGELOG_PATH = resolve(__dirname, '../skill/tokonomix-consensus/CHANGELOG.md');
// Last-seen skill version persisted between sessions so we can show the user a
// one-time "you received a new Tokonomix update v<old> → v<new>" notice when the
// server-side skill changes. Lives next to the credentials file (dir 0700).
const SKILL_STATE_FILE = resolve(CREDENTIALS_DIR, 'skill-state.json');

interface SkillSnapshot {
  content: string;
  sha256: string;
  version: string;        // short hash used as opaque version id
  semver?: string;        // human version (frontmatter `version:`, e.g. 1.1.0)
  released?: string;      // release date (frontmatter `released:`, YYYY-MM-DD)
  changes?: string[];     // latest CHANGELOG entry highlights
  lastChanged: string;    // mtime / server last_changed, ISO
  bytes: number;
  source: 'server' | 'bundled';
}

let _skillCache: SkillSnapshot | null = null;
let _skillCacheAt = 0;
const SKILL_TTL_MS = 10 * 60 * 1000; // re-check the server at most every 10 min

// Fire-once update notice, surfaced on the next tool response's trailer.
let _pendingUpdateNotice: string | null = null;
let _didStartupSkillCheck = false;

interface SkillState { semver?: string; sha256?: string }

function parseSkillFrontmatter(content: string): { semver?: string; released?: string } {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  return {
    semver: m[1].match(/^version:\s*(.+?)\s*$/m)?.[1],
    released: m[1].match(/^released:\s*(.+?)\s*$/m)?.[1],
  };
}

/** Highlights of the most recent CHANGELOG.md entry (bullets under the first
 *  `## <semver> — <YYYY-MM-DD>` heading). Accepts em-dash or hyphen separator. */
function parseLatestChanges(changelogMd: string): string[] {
  const head = changelogMd.match(/^##\s+\S+\s+[—-]\s+\d{4}-\d{2}-\d{2}\s*$/m);
  if (!head || head.index === undefined) return [];
  const rest = changelogMd.slice(head.index + head[0].length);
  const next = rest.search(/^##\s+/m);
  const block = next === -1 ? rest : rest.slice(0, next);
  return [...block.matchAll(/^-\s+(.+?)\s*$/gm)].map((x) => x[1]);
}

function readSkillState(): SkillState | null {
  try { return JSON.parse(readFileSync(SKILL_STATE_FILE, 'utf8')) as SkillState; }
  catch { return null; }
}

function writeSkillState(st: SkillState): void {
  try {
    mkdirSync(CREDENTIALS_DIR, { recursive: true, mode: 0o700 });
    writeFileSync(SKILL_STATE_FILE, JSON.stringify(st), { encoding: 'utf8', mode: 0o600 });
  } catch { /* best-effort: a non-writable home must not break tool calls */ }
}

/** Compare a freshly-fetched server skill to the last-seen persisted version.
 *  On a real change, arm a one-time update notice. Never notifies on first run
 *  (no prior state) — that would fire on every brand-new install. */
function detectSkillUpdate(snap: SkillSnapshot): void {
  if (snap.source !== 'server' || !snap.sha256) return;
  const prev = readSkillState();
  if (prev?.sha256 && prev.sha256 !== snap.sha256) {
    // The notice is built from gateway-supplied strings and rendered in the
    // user's terminal + the agent's context — strip control chars (ANSI escapes)
    // and cap length/count so a malformed or hostile payload can't injection-
    // attack the terminal or balloon every response.
    const clean = (s: unknown) => String(s ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').slice(0, 200);
    const to = clean(snap.semver ?? snap.version);
    const date = snap.released ? ` (released ${clean(snap.released)})` : '';
    const items = (Array.isArray(snap.changes) ? snap.changes : []).slice(0, 10).map(clean);
    const changes = items.length ? '\n' + items.map((c) => `  • ${c}`).join('\n') : ' see CHANGELOG';
    _pendingUpdateNotice =
      `📦 You received a new Tokonomix update — v${clean(prev.semver ?? '?')} → v${to}${date}.\nKey changes:${changes}`;
  }
  if (prev?.sha256 !== snap.sha256) {
    writeSkillState({ semver: snap.semver ?? snap.version, sha256: snap.sha256 });
  }
}

/** One cheap meta fetch on the first tool call of a session, so the passive
 *  trailer reflects the server version and the update notice can fire. */
async function ensureStartupSkillCheck(): Promise<void> {
  if (_didStartupSkillCheck) return;
  _didStartupSkillCheck = true;
  try { await getSkill(false); } catch { /* non-fatal */ }
}

/** Bundled SKILL.md — offline fallback only. */
function loadBundledSkill(): SkillSnapshot {
  try {
    const content = readFileSync(SKILL_MD_PATH, 'utf8');
    const stat = statSync(SKILL_MD_PATH);
    const sha256 = createHash('sha256').update(content).digest('hex');
    const fm = parseSkillFrontmatter(content);
    let changes: string[] = [];
    try { changes = parseLatestChanges(readFileSync(CHANGELOG_PATH, 'utf8')); } catch { /* no changelog */ }
    // UTF-8 byte length (matches the server's /api/v1/skill `bytes`), not the
    // JS UTF-16 char count — keeps the offline-fallback fingerprint consistent.
    return { content, sha256, version: sha256.slice(0, 12), semver: fm.semver, released: fm.released, changes, lastChanged: stat.mtime.toISOString(), bytes: Buffer.byteLength(content, 'utf8'), source: 'bundled' };
  } catch (err) {
    console.error('[tokonomix-council-mcp] WARN: bundled SKILL.md unreadable:', err);
    return { content: '(SKILL.md not bundled in this install)', sha256: '0'.repeat(64), version: 'unknown', lastChanged: new Date(0).toISOString(), bytes: 0, source: 'bundled' };
  }
}

/** Fetch the server-canonical skill over HTTPS; fall back to bundled on error.
 *  `full=false` fetches only the cheap fingerprint (no content). Cached TTL. */
async function getSkill(full: boolean): Promise<SkillSnapshot> {
  const fresh = _skillCache && Date.now() - _skillCacheAt < SKILL_TTL_MS;
  if (fresh && (!full || _skillCache!.content)) return _skillCache!;
  try {
    const res = await fetch(`${BASE_URL}/skill${full ? '' : '?meta=1'}`, {
      headers: { 'User-Agent': 'tokonomix-council-mcp/skill' },
    });
    if (!res.ok) throw new Error(`skill endpoint ${res.status}`);
    const d = (await res.json()) as Partial<SkillSnapshot> & { last_changed?: string };
    _skillCache = {
      content: typeof d.content === 'string' ? d.content : (_skillCache?.content ?? ''),
      sha256: d.sha256 ?? '',
      version: d.version ?? (d.sha256 ?? '').slice(0, 12),
      semver: d.semver,
      released: d.released,
      changes: Array.isArray(d.changes) ? d.changes : undefined,
      lastChanged: d.last_changed ?? new Date().toISOString(),
      bytes: d.bytes ?? 0,
      source: 'server',
    };
    _skillCacheAt = Date.now();
    detectSkillUpdate(_skillCache);
    return _skillCache;
  } catch (err) {
    console.error('[tokonomix-council-mcp] skill HTTPS fetch failed, using bundled fallback:', err);
    _skillCache = loadBundledSkill();
    _skillCacheAt = Date.now();
    return _skillCache;
  }
}

/** Synchronous best-effort version for the passive trailer — uses the last
 *  cached snapshot (server if we've fetched it, else bundled). Never blocks. */
function cachedSkillVersion(): string {
  return (_skillCache ?? loadBundledSkill()).version;
}

/** One-line trailer appended to every tool response so agents see the
 *  current skill version passively in the normal flow. They can compare
 *  against their cached version and call tokonomix_get_skill() on mismatch. */
function skillVersionTrailer(): { type: 'text'; text: string } {
  let prefix = '';
  if (_pendingUpdateNotice) {
    prefix = _pendingUpdateNotice + '\n\n';
    _pendingUpdateNotice = null; // fire once
  }
  return {
    type: 'text',
    text: `${prefix}\n_skill_version=${cachedSkillVersion()} (call tokonomix_get_skill if your cached SKILL.md differs)`,
  };
}

// ─── Image input support ─────────────────────────────────────────────────────
//
// The gateway (POST /api/v1/chat/completions) accepts OpenAI-style content-part
// arrays in user messages:
//   [{ type: 'text', text: '...' }, { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,...' }}]
//
// MCP callers pass images as structured objects so they don't have to manually
// assemble data-URL strings. Each image is:
//   { data: string (raw base64, NO "data:..." prefix), media_type: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' }
//
// Constraints (mirroring the gateway):
//   - media_type: one of the four MIME types above
//   - data: raw base64 (no data-URL prefix); decoded size <5 MB
//   - count: ≤8 images per message
//   - total decoded size: ≤20 MB across all images in the request
//   - non-streaming only (the MCP server never sets stream:true; images are no-ops here)
//   - vision-capable models only — validated server-side; non-vision models in an
//     explicit council list are skipped (reported in x_council.skipped), and a
//     non-vision explicit single model gets a 400 from the gateway
//
// Council auto-selection (no models given): the gateway selects a default
// vision panel (claude-fable-5 + gemini-2.5-pro + gpt-4o class) automatically
// when images are present.

const ALLOWED_IMAGE_MEDIA_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const);

type AllowedMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

/** A single image provided by the MCP caller. */
export interface McpImage {
  /** Raw base64-encoded image data — no "data:..." prefix. */
  data: string;
  /** MIME type of the image. */
  media_type: AllowedMediaType;
}

/** Validation errors that indicate a bad caller payload (fast client-side reject). */
export class ImageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageValidationError';
  }
}

/**
 * Validate an array of MCP image objects and convert them to OpenAI content-part
 * image_url objects with inline data-URLs. Throws ImageValidationError on any
 * constraint violation. Returns an empty array when `rawImages` is absent or
 * empty (text-only call — caller should send `content: string`, not an array).
 */
export function validateAndConvertImages(
  rawImages: unknown,
): Array<{ type: 'image_url'; image_url: { url: string } }> {
  if (!rawImages) return [];
  if (!Array.isArray(rawImages)) {
    throw new ImageValidationError('images must be an array');
  }
  if (rawImages.length === 0) return [];
  if (rawImages.length > 8) {
    throw new ImageValidationError(`too many images: ${rawImages.length} (max 8 per message)`);
  }

  const parts: Array<{ type: 'image_url'; image_url: { url: string } }> = [];
  let totalDecodedBytes = 0;

  for (let i = 0; i < rawImages.length; i++) {
    const img = rawImages[i] as Record<string, unknown>;
    if (!img || typeof img !== 'object') {
      throw new ImageValidationError(`images[${i}]: must be an object with data and media_type`);
    }

    const mediaType = img.media_type;
    if (typeof mediaType !== 'string' || !ALLOWED_IMAGE_MEDIA_TYPES.has(mediaType as AllowedMediaType)) {
      throw new ImageValidationError(
        `images[${i}].media_type: must be one of image/jpeg, image/png, image/webp, image/gif — got ${JSON.stringify(mediaType)}`,
      );
    }

    const data = img.data;
    if (typeof data !== 'string' || data.trim() === '') {
      throw new ImageValidationError(`images[${i}].data: must be a non-empty base64 string (no data-URL prefix)`);
    }

    // Reject accidental data-URL pastes — the caller should strip the prefix.
    if (data.startsWith('data:')) {
      throw new ImageValidationError(
        `images[${i}].data: looks like a data-URL (starts with "data:") — strip the prefix and pass raw base64 only`,
      );
    }

    // Cheap size check: base64 string length * 0.75 ≈ decoded byte count.
    // Slightly over-estimates (ignores padding), which is intentional — stay well
    // under the 5 MB per-image limit rather than allowing right-at-edge payloads.
    const approxDecodedBytes = Math.ceil(data.length * 0.75);
    const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
    if (approxDecodedBytes > MAX_IMAGE_BYTES) {
      throw new ImageValidationError(
        `images[${i}]: decoded size ~${(approxDecodedBytes / (1024 * 1024)).toFixed(1)} MB exceeds the 5 MB per-image limit`,
      );
    }

    totalDecodedBytes += approxDecodedBytes;
    const MAX_TOTAL_BYTES = 20 * 1024 * 1024; // 20 MB
    if (totalDecodedBytes > MAX_TOTAL_BYTES) {
      throw new ImageValidationError(
        `images total decoded size ~${(totalDecodedBytes / (1024 * 1024)).toFixed(1)} MB exceeds the 20 MB per-request limit`,
      );
    }

    parts.push({
      type: 'image_url',
      image_url: { url: `data:${mediaType as string};base64,${data}` },
    });
  }

  return parts;
}

/**
 * Build the `content` value for the user message. When images are present,
 * returns an OpenAI-style content-part array (text part first, then image
 * parts). When there are no images, returns a plain string — keeping the wire
 * format identical to existing text-only calls so non-vision server paths
 * are unaffected.
 */
export function buildUserContent(
  prompt: string,
  imageParts: Array<{ type: 'image_url'; image_url: { url: string } }>,
): string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> {
  if (imageParts.length === 0) return prompt;
  return [
    { type: 'text' as const, text: prompt },
    ...imageParts,
  ];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build auth headers for /api/v1 gateway calls. Throws if no key available. */
function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    Authorization: `Bearer ${requireApiKey()}`,
    'Content-Type': 'application/json',
    'User-Agent': 'tokonomix-council-mcp/0.1.0',
    ...extra,
  };
}

/**
 * Normalise the optional `context` argument (INT-1817) into the structured
 * `{inline, github_refs}` shape carried on `x_council.context`. The server folds
 * it into the last user message (when context-upload is enabled) so proposers
 * AND the judge see identical grounding. Returns undefined when there is nothing
 * usable, so old prompt-only calls are byte-identical on the wire.
 */
function normalizeContext(raw: unknown): Record<string, unknown> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const c = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  if (Array.isArray(c.inline)) {
    const inline = c.inline
      .filter((it): it is Record<string, unknown> => !!it && typeof it === 'object')
      .map((it) => {
        const item: Record<string, unknown> = { content: String(it.content ?? '') };
        if (typeof it.path === 'string' && it.path) item.path = it.path;
        if (typeof it.lang === 'string' && it.lang) item.lang = it.lang;
        return item;
      })
      .filter((it) => String(it.content).trim().length > 0);
    if (inline.length > 0) out.inline = inline;
  }

  if (Array.isArray(c.github_refs)) {
    const refs = c.github_refs.filter((r): r is string => typeof r === 'string' && r.trim().length > 0);
    if (refs.length > 0) out.github_refs = refs;
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

async function tokonomixFetch(path: string, init: RequestInit = {}): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`, init);
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // not json
  }
  if (!res.ok) {
    const errPayload = json && typeof json === 'object' ? (json as { error?: { message?: string; code?: string; request_id?: string } }).error : undefined;
    throw new Error(
      `Tokonomix API ${res.status}: ${errPayload?.message ?? text.slice(0, 200)} (code=${errPayload?.code ?? 'unknown'}, request_id=${errPayload?.request_id ?? '-'})`,
    );
  }
  return json;
}

/** Fetch helper for MAIN-app endpoints (/api/onboard/*).
 *  These are on SITE_BASE (e.g. https://tokonomix.ai), NOT the /api/v1 gateway.
 *  Error shape from these routes: {ok:false, error:"<string>"} — NOT the
 *  {error:{message,code,request_id}} shape that /api/v1 uses. */
async function siteFetch(
  path: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${SITE_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'tokonomix-council-mcp/0.1.0',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    // not json
  }
  if (!res.ok) {
    const errMsg =
      typeof json.error === 'string' ? json.error : text.slice(0, 200) || `HTTP ${res.status}`;
    throw new Error(`Onboard API ${res.status}: ${errMsg}`);
  }
  return json;
}

// ─── mode:"full" — client-side composition (Option A in SPEC-…full-mode) ────
// Returns the full proposer answers + the judge's per-proposer agree/disagree
// reasoning + a clear conclusion in a single MCP response. Two underlying API
// calls, both billed by the backend exactly as normal raw passthroughs.

interface RawProposer {
  model: string;
  latency_ms?: number;
  input_tokens?: number;
  output_tokens?: number;
  cost_micros?: number;
  content?: string | null;
  error?: { code: string; message: string };
}

interface FullModeRawResponse {
  choices: Array<{ message: { content: string } }>;
  x_council: {
    per_model: RawProposer[];
    charged_credits: number;
  };
}

interface FullModeJudgeResponse {
  model: string;
  choices: Array<{ message: { content: string } }>;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  x_council: { charged_credits: number };
}

const FULL_MODE_DEFAULT_JUDGE = 'claude-sonnet-4-6';

const FULL_MODE_JUDGE_SYSTEM = [
  'You are a synthesis judge. You have received responses from multiple AI proposers.',
  '',
  'Your task:',
  '1. Read all proposer responses carefully.',
  '2. For each proposer, explicitly state: what you agree with, what you disagree with, and why.',
  '3. Synthesize the strongest answer based on your analysis.',
  '4. End with a clear, definitive conclusion that directly answers the original question.',
  '',
  'Structure your response exactly as follows (use these literal markdown headings):',
  '',
  '### Beweegredenen',
  'For each proposer (named "Proposer 1", "Proposer 2", …):',
  '- What you agree with',
  '- What you disagree with',
  '- Why',
  '(Minimum 2-3 sentences per proposer.)',
  '',
  '### Eindconclusie',
  'The definitive answer to the original question. Direct, 1-5 sentences. No hedging unless the proposers genuinely converge on uncertainty.',
].join('\n');

function parseJudgeOutput(judgeContent: string): { reasoning: string; conclusion: string } {
  // Robust parse: look for explicit headings, fall back to splitting on
  // "Eindconclusie" if the model lost the markdown framing.
  const conclusionMatch = judgeContent.match(/###\s*Eindconclusie\s*\n([\s\S]*?)$/i);
  if (conclusionMatch) {
    const reasoningPart = judgeContent.slice(0, conclusionMatch.index ?? 0);
    const cleanedReasoning = reasoningPart
      .replace(/###\s*Beweegredenen\s*\n?/i, '')
      .trim();
    return {
      reasoning: cleanedReasoning,
      conclusion: conclusionMatch[1].trim(),
    };
  }
  // Fallback heuristic — split on "conclusie" word boundary.
  const fallback = judgeContent.split(/\n#+\s*(?:Eindconclusie|Conclusion)/i);
  if (fallback.length >= 2) {
    return { reasoning: fallback[0].trim(), conclusion: fallback.slice(1).join('').trim() };
  }
  return { reasoning: judgeContent.trim(), conclusion: '' };
}

function buildJudgePrompt(originalQuestion: string, proposers: RawProposer[]): string {
  const labelled = proposers
    .filter((p) => p.content && !p.error)
    .map((p, i) => `## Proposer ${i + 1}: ${p.model}\n\n${p.content}`)
    .join('\n\n');
  return [
    `Original user question:\n\n${originalQuestion}\n\n---\n`,
    `Proposer responses:\n\n${labelled}\n\n---\n`,
    `Now produce your synthesis following the structure in your system prompt exactly.`,
  ].join('');
}

function buildFullModeReadableContent(
  proposers: RawProposer[],
  judgeModel: string,
  reasoning: string,
  conclusion: string,
): string {
  const proposerSections = proposers
    .filter((p) => p.content && !p.error)
    .map((p, i) => `## Proposer ${i + 1}: ${p.model}\n\n${p.content}`)
    .join('\n\n');
  const errors = proposers
    .filter((p) => p.error)
    .map((p) => `- ${p.model}: ERROR (${p.error?.code ?? '?'})`)
    .join('\n');
  const errorBlock = errors ? `\n\n_Proposer errors:_\n${errors}` : '';
  return [
    proposerSections,
    errorBlock,
    `\n\n---\n\n## Judge: ${judgeModel}\n\n### Beweegredenen\n\n${reasoning}\n\n### Eindconclusie\n\n${conclusion}`,
  ].join('');
}

async function runFullMode(a: Record<string, unknown>): Promise<{
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}> {
  const prompt = String(a.prompt ?? '');
  if (!prompt) throw new Error('prompt is required');
  const judgeModel =
    typeof a.judge_model === 'string' && a.judge_model
      ? a.judge_model
      : FULL_MODE_DEFAULT_JUDGE;

  // ── Step 1 — raw fan-out to harvest proposer content.
  // Images are passed through to the fan-out call so vision-capable proposers
  // receive them. The judge step uses text-only (the proposer answers are text).
  const imageParts = validateAndConvertImages(a.images);
  const userContent = buildUserContent(prompt, imageParts);

  const messages: Array<{ role: string; content: unknown }> = [];
  if (typeof a.system === 'string' && a.system) {
    messages.push({ role: 'system', content: a.system });
  }
  messages.push({ role: 'user', content: userContent });

  const rawBody: Record<string, unknown> = {
    model: 'tokonomix-consensus',
    messages,
    x_council: { mode: 'raw' },
  };
  if (Array.isArray(a.models) && a.models.length > 0) {
    (rawBody.x_council as Record<string, unknown>).models = a.models;
  }
  const fullCtx = normalizeContext(a.context);
  if (fullCtx) (rawBody.x_council as Record<string, unknown>).context = fullCtx;
  if (typeof a.max_tokens === 'number') rawBody.max_tokens = a.max_tokens;

  const rawResultUnknown = await tokonomixFetch('/chat/completions', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(rawBody),
  });
  const rawResult = rawResultUnknown as FullModeRawResponse;
  const proposers = rawResult.x_council.per_model ?? [];

  // Inline content into proposers (raw mode embeds answers in choices[0],
  // but cleaner to read each model's content from per_model when the backend
  // populates it; raw-mode response includes content in choices array
  // serialised JSON — parse if needed).
  // The backend's raw mode actually stuffs all proposer contents into
  // choices[0].message.content as a JSON-encoded array of {modelId,content}.
  // Decode and merge into per_model entries.
  try {
    const choiceContent = rawResult.choices?.[0]?.message?.content ?? '';
    const parsed = JSON.parse(choiceContent) as Array<{ modelId?: string; content?: string }>;
    if (Array.isArray(parsed)) {
      for (const proposer of proposers) {
        const match = parsed.find((p) => p.modelId === proposer.model);
        if (match && match.content) proposer.content = match.content;
      }
    }
  } catch {
    // Not JSON-shaped — leave proposer.content as whatever the backend set
    // (newer backends embed content directly in per_model).
  }

  const usableProposers = proposers.filter((p) => p.content && !p.error);
  if (usableProposers.length === 0) {
    return {
      content: [
        {
          type: 'text',
          text:
            'mode "full" fan-out returned no usable proposer content. ' +
            'All proposers errored or were empty. Falling back is not possible at this point — retry with fewer or different models.',
        },
        skillVersionTrailer(),
      ],
      isError: true,
    };
  }

  // ── Step 2 — single-model judge call.
  const judgePromptText = buildJudgePrompt(prompt, proposers);
  const judgeBody: Record<string, unknown> = {
    model: judgeModel,
    messages: [
      { role: 'system', content: FULL_MODE_JUDGE_SYSTEM },
      { role: 'user', content: judgePromptText },
    ],
  };
  // Auto-sized judge budget (2026-06-06). The judge synthesizes ALL proposer
  // answers into one structured result, so its output budget scales with the
  // proposer count rather than a flat default (the old flat 8192 truncated large
  // multi-proposer syntheses). Mirrors lib/api/synthesizer/judge-budget.ts — the
  // formula is inlined because the MCP server is a separate package. The backend
  // clamps to MAX_TOKENS_CEILING (16384) regardless; for more, batch/split.
  const JUDGE_BASE = 4096, JUDGE_PER_PROPOSER = 2048, JUDGE_MIN = 4096, JUDGE_MAX = 16384;
  const autoJudgeBudget = Math.min(JUDGE_MAX, Math.max(JUDGE_MIN, JUDGE_BASE + JUDGE_PER_PROPOSER * proposers.length));
  // A caller-supplied max_tokens may raise the floor but never lowers the auto
  // budget (capped at the backend ceiling).
  judgeBody.max_tokens = typeof a.max_tokens === 'number'
    ? Math.min(JUDGE_MAX, Math.max(autoJudgeBudget, a.max_tokens as number))
    : autoJudgeBudget;

  let judgeResult: FullModeJudgeResponse;
  try {
    judgeResult = (await tokonomixFetch('/chat/completions', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(judgeBody),
    })) as FullModeJudgeResponse;
  } catch (err) {
    // Graceful fallback to raw-mode behaviour per acceptatiecriterium 6:
    // "Bij judge-fout: graceful fallback naar `raw` (bestaand gedrag behouden)."
    const proposerSections = usableProposers
      .map((p, i) => `## Proposer ${i + 1}: ${p.model}\n\n${p.content}`)
      .join('\n\n');
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [
        { type: 'text', text: proposerSections },
        {
          type: 'text',
          text:
            `\n---\nJudge call failed (${message.slice(0, 200)}). ` +
            `Returning proposer content only — treat this response as mode:"raw".`,
        },
        skillVersionTrailer(),
      ],
    };
  }

  const judgeContent = judgeResult.choices?.[0]?.message?.content ?? '';
  const { reasoning, conclusion } = parseJudgeOutput(judgeContent);

  // ── Step 3 — combine into the spec-defined response shape.
  const readableContent = buildFullModeReadableContent(
    proposers,
    judgeResult.model ?? judgeModel,
    reasoning,
    conclusion,
  );

  // cost_micros = raw provider cost-of-goods (pre-markup), 1 cent = 10_000 micros.
  // This is NOT the charged amount (see `Total charged` below for that).
  const proposerLines = proposers.map((p) => {
    if (p.error) return `${p.model}: ERROR (${p.error.code})`;
    return `${p.model}: ${((p.cost_micros ?? 0) / 10_000).toFixed(2)}c provider cost · ${p.latency_ms ?? '?'}ms`;
  }).join('\n');

  const totalCharged =
    (rawResult.x_council?.charged_credits ?? 0) + (judgeResult.x_council?.charged_credits ?? 0);

  return {
    content: [
      { type: 'text', text: readableContent },
      {
        type: 'text',
        text:
          `\n---\nMode: full · Total charged: ${totalCharged} cents (raw: ${rawResult.x_council?.charged_credits ?? 0}c + judge: ${judgeResult.x_council?.charged_credits ?? 0}c)\n` +
          `Judge: ${judgeResult.model ?? judgeModel} · ` +
          `Proposers:\n${proposerLines}`,
      },
      skillVersionTrailer(),
    ],
  };
}

// ─── MCP server ──────────────────────────────────────────────────────────────

const server = new Server(
  { name: 'tokonomix-council-mcp', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

// ─── Tool list ───────────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'tokonomix_consensus_ask',
    description: [
      'Ask 2-6 frontier LLM proposers (parallel + blind) and reconcile via an independent judge (disjoint from the proposers, never scoring its own answer). A recall amplifier that surfaces disagreement a single model hides — it reduces single-model error but does NOT guarantee correctness (frontier models share training data, so agreement is not proof; ground high-stakes facts). Use mode:diff to keep the lone dissent instead of averaging it away.',
      'Use this when correctness matters more than latency: legal questions, code review, fact-checking, high-stakes reasoning.',
      'Modes: consensus (judge synthesizes one answer, default), diff (agreements + disagreements report), best_of (judge picks single strongest), raw (array of all responses).',
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
          description: 'Synthesis mode. `consensus` (default) = one merged answer (trades dissent away). `diff` = agreements + disagreements report — BEST for discovery/review: preserves the one model that caught the edge case. `best_of` = judge picks the single strongest verbatim. `raw` = all answers, no judge (cheapest). `full` = proposers + per-proposer judge reasoning + conclusion (extra judge call).',
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
      'Filter by hosting region for EU-compliance routing, by provider, by tier, or by capability.',
      'Returns id, owned_by, hosting_region, context_window, input/output price per 1M cents, capabilities (tools, vision, json_schema, prompt_caching, reasoning, audio_input, pdf_input).',
    ].join(' '),
    inputSchema: {
      type: 'object',
      properties: {
        hosting_region: {
          type: 'string',
          enum: ['eu', 'fr', 'us', 'multi'],
          description: '"eu" matches eu OR fr. Use for GDPR-strict routing.',
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
          description: 'ISO 3166-1 alpha-2 country code of the model\'s origin (e.g. "US", "FR", "DE"). Filters to models whose AI lab is headquartered in that country. Useful for sovereignty-aware routing.',
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
];

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

      const messages: Array<{ role: string; content: unknown }> = [];
      if (typeof a.system === 'string' && a.system) {
        messages.push({ role: 'system', content: a.system });
      }
      messages.push({ role: 'user', content: userContent });

      const xCouncil: Record<string, unknown> = {};
      if (typeof a.mode === 'string') xCouncil.mode = a.mode;
      if (Array.isArray(a.models) && a.models.length > 0) xCouncil.models = a.models;
      if (typeof a.judge_model === 'string' && a.judge_model) xCouncil.judge_model = a.judge_model;
      if (Array.isArray(a.judge_models) && a.judge_models.length > 0) xCouncil.judge_models = a.judge_models;
      const ctx = normalizeContext(a.context);
      if (ctx) xCouncil.context = ctx;

      const body: Record<string, unknown> = {
        model: 'tokonomix-consensus',
        messages,
      };
      if (Object.keys(xCouncil).length > 0) body.x_council = xCouncil;
      if (typeof a.max_tokens === 'number') body.max_tokens = a.max_tokens;

      const result = await tokonomixFetch('/chat/completions', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });

      const r = result as {
        choices: Array<{ message: { content: string } }>;
        usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
        x_council: { mode: string; per_model: Array<{ model: string; cost_micros?: number; error?: { code: string; message: string } }>; charged_credits: number; synth: { fallback_to_raw: boolean } };
      };

      // cost_micros is each proposer's RAW provider cost-of-goods (pre-markup),
      // NOT what you are charged. 1 cent = 10_000 micros (see lib/api/providers
      // /cost.ts centsToMicros). The actual charge is `charged_credits`, which
      // stacks all proposers + the judge and applies the platform markup, so the
      // per-proposer numbers below will NOT sum to charged_credits.
      const breakdown = r.x_council.per_model.map((m) => {
        if (m.error) return `${m.model}: ERROR (${m.error.code})`;
        return `${m.model}: ${((m.cost_micros ?? 0) / 10_000).toFixed(2)}c provider cost`;
      }).join('\n');

      return {
        content: [
          {
            type: 'text',
            text: r.choices[0]?.message?.content ?? '(no content)',
          },
          {
            type: 'text',
            text: `\n---\nCharged: ${r.x_council.charged_credits} cents · Mode: ${r.x_council.mode} · Proposers (provider cost, pre-markup, not charged):\n${breakdown}`,
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

      const messages: Array<{ role: string; content: unknown }> = [];
      if (typeof a.system === 'string' && a.system) {
        messages.push({ role: 'system', content: a.system });
      }
      messages.push({ role: 'user', content: userContent });

      const body: Record<string, unknown> = {
        model,
        messages,
      };
      if (typeof a.max_tokens === 'number') body.max_tokens = a.max_tokens;

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
              `Month-to-date: €${(r.month_to_date.spend_cents / 100).toFixed(2)} across ${r.month_to_date.calls} calls\n` +
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

      // siteFetch throws on non-2xx; any HTTP error (400 disposable, 429 rate-limit) surfaces here.
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
