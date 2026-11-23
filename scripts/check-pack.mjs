#!/usr/bin/env node
// Publication guard (review 4.7). Inspects exactly what `npm pack` would ship and
// fails if any forbidden artefact sneaks into the tarball. The working skill draft
// was accidentally published in 1.7.1/1.7.6/1.7.7; the `files` field + .npmignore
// are the first line of defence, this is the fail-closed backstop that runs on
// `prepublishOnly` (and manually via `npm run check:pack`).
//
// It shells out to `npm pack --dry-run --json`. That does not fire prepublishOnly
// (only publish does), so there is no recursion.

import { execFileSync } from 'node:child_process';

const FORBIDDEN = [
  { re: /\.draft\.md$/i, why: 'working draft (leaked in 1.7.x)' },
  { re: /\.test\.[cm]?[jt]s(\.map|\.d\.ts)?$/i, why: 'test file' },
  { re: /(^|\/)src\//, why: 'raw TypeScript source (ship dist/ only)' },
  { re: /(^|\/)\.env/i, why: 'environment / secrets file' },
  { re: /(^|\/)node_modules\//, why: 'vendored dependency' },
  { re: /\.(key|pem|p12|pfx)$/i, why: 'private key material' },
];

// The only top-level entries the package is meant to ship (mirrors package.json
// "files"). A new top-level entry is a warning, not a hard fail — but it is loud.
const EXPECTED_TOP = new Set(['dist', 'skill', 'README.md', 'LICENSE', 'package.json']);

let out;
try {
  out = execFileSync('npm', ['pack', '--dry-run', '--json'], { encoding: 'utf8' });
} catch (err) {
  console.error('[check-pack] `npm pack --dry-run` failed:', err.message);
  process.exit(2);
}

let files;
try {
  files = JSON.parse(out)[0].files.map((f) => f.path);
} catch (err) {
  console.error('[check-pack] could not parse npm pack output:', err.message);
  process.exit(2);
}

console.log(`[check-pack] tarball would contain ${files.length} files:`);
for (const f of files) console.log('  ' + f);

const violations = [];
for (const f of files) {
  for (const rule of FORBIDDEN) {
    if (rule.re.test(f)) violations.push(`${f} — ${rule.why}`);
  }
}

const unexpectedTop = [...new Set(files.map((f) => f.split('/')[0]))].filter(
  (t) => !EXPECTED_TOP.has(t),
);
if (unexpectedTop.length) {
  console.warn('[check-pack] WARNING unexpected top-level entries: ' + unexpectedTop.join(', '));
}

if (violations.length) {
  console.error('\n[check-pack] FAIL — forbidden files in the tarball:');
  for (const v of violations) console.error('  ✗ ' + v);
  console.error('\nFix the packaging (files/.npmignore) before publishing.');
  process.exit(1);
}

console.log('\n[check-pack] OK — no forbidden artefacts in the tarball.');
