import { readFileSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

// ─── Credentials file ─────────────────────────────────────────────────────────
// ~/.tokonomix/credentials.json — written with mode 0600 / dir 0700.
// Shape: { api_key: string, account_id?: string, created_at: string }
export const CREDENTIALS_DIR = resolve(homedir(), '.tokonomix');
export const CREDENTIALS_FILE = resolve(CREDENTIALS_DIR, 'credentials.json');

export interface CredentialsFile {
  api_key: string;
  account_id?: string;
  created_at: string;
}

/** Read the persisted credentials file; returns null if missing or malformed. */
export function readCredentialsFile(): CredentialsFile | null {
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
export function writeCredentialsFile(creds: CredentialsFile): void {
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
export function resolveApiKey(): string | null {
  const env = process.env.TOKONOMIX_API_KEY;
  if (env && env.trim()) return env.trim();
  const creds = readCredentialsFile();
  return creds?.api_key ?? null;
}

/** Like resolveApiKey() but throws a friendly Error when no key is available.
 *  Called from authHeaders() so every key-gated tool gets the same guidance. */
export function requireApiKey(): string {
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
