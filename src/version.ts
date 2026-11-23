import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Single source of truth for the package version (14f6b0fd): read it from
// package.json rather than hardcoding 0.1.0 in three places, so User-Agent +
// serverInfo telemetry always reflect the real published version.
export const VERSION: string = (() => {
  try {
    return JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8')).version || '0.0.0';
  } catch {
    return '0.0.0';
  }
})();
