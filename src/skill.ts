import { readFileSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { CREDENTIALS_DIR } from './credentials.js';
import { BASE_URL } from './http.js';

// Control-character stripper (ASCII 0x00-0x1F and 0x7F, i.e. C0 controls + DEL)
// used to sanitize gateway-supplied update-notice strings before they hit the
// terminal / agent context. Built via fromCharCode rather than a \u escape
// literal in the regex source to avoid any escape-decoding ambiguity.
const CONTROL_CHARS_RE = new RegExp(
  `[${String.fromCharCode(0)}-${String.fromCharCode(31)}${String.fromCharCode(127)}]`,
  'g',
);

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

export interface SkillSnapshot {
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
    const clean = (s: unknown) => String(s ?? '').replace(CONTROL_CHARS_RE, ' ').slice(0, 200);
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
export async function ensureStartupSkillCheck(): Promise<void> {
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
export async function getSkill(full: boolean): Promise<SkillSnapshot> {
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
export function skillVersionTrailer(): { type: 'text'; text: string } {
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
