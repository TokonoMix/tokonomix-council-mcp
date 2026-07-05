import { requireApiKey } from './credentials.js';
import { VERSION } from './version.js';
import { assertSafeBaseUrl } from './base-url-guard.js';

export const BASE_URL = (process.env.TOKONOMIX_BASE_URL ?? 'https://tokonomix.ai/api/v1').replace(/\/$/, '');

// ─── Site origin (main app, NOT /api/v1) ─────────────────────────────────────
// The onboard endpoints (/api/onboard/start and /api/onboard/verify) live on
// the main Next.js app, not the /api/v1 gateway. We derive the site origin by:
//   1. Checking TOKONOMIX_SITE_URL env var (explicit override).
//   2. Stripping /api/v1 from BASE_URL when it ends with that path.
//   3. Falling back to https://tokonomix.ai (the production default).
export const SITE_BASE = (
  process.env.TOKONOMIX_SITE_URL
    ? process.env.TOKONOMIX_SITE_URL
    : BASE_URL.endsWith('/api/v1')
      ? BASE_URL.slice(0, -'/api/v1'.length)
      : 'https://tokonomix.ai'
).replace(/\/$/, '');

// Defense-in-depth: reject an insecure or accidentally-redirected gateway
// origin at startup (see base-url-guard.ts for the policy). Runs once, at
// module load — before any outbound request can be made with these origins.
assertSafeBaseUrl(BASE_URL, 'TOKONOMIX_BASE_URL');
assertSafeBaseUrl(SITE_BASE, 'TOKONOMIX_SITE_URL');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build auth headers for /api/v1 gateway calls. Throws if no key available. */
export function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    Authorization: `Bearer ${requireApiKey()}`,
    'Content-Type': 'application/json',
    'User-Agent': `tokonomix-council-mcp/${VERSION}`,
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
export function normalizeContext(raw: unknown): Record<string, unknown> | undefined {
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

  // B08 (escalated form): pass an upload-session id + opaque handles through to
  // the gateway. These are NEVER urls (no SSRF) — just the ids returned by
  // tokonomix_upload. Server-gated: ignored unless context-upload is enabled.
  if (typeof c.session === 'string' && c.session.trim().length > 0) out.session = c.session.trim();
  if (Array.isArray(c.handles)) {
    const handles = c.handles.filter((h): h is string => typeof h === 'string' && h.trim().length > 0);
    if (handles.length > 0) out.handles = handles;
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

export async function tokonomixFetch(path: string, init: RequestInit = {}): Promise<unknown> {
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
export async function siteFetch(
  path: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${SITE_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': `tokonomix-council-mcp/${VERSION}`,
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
