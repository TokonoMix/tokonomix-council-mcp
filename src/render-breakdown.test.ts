import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  renderProposerBreakdown,
  renderSkipped,
  maxTokensAdvisory,
  JUDGE_MAX_OUTPUT_TOKENS,
} from './render.js';

test('renderProposerBreakdown: cost line per proposer (micros → cents)', () => {
  const out = renderProposerBreakdown([
    { model: 'gpt-5', cost_micros: 21800 },
    { model: 'gemini-2.5-pro', cost_micros: 21800 },
  ]);
  assert.equal(out, 'gpt-5: 2.18c provider cost\ngemini-2.5-pro: 2.18c provider cost');
});

test('renderProposerBreakdown: ERROR path is rendered, not the cost', () => {
  const out = renderProposerBreakdown([
    { model: 'claude-sonnet-5', error: { code: 'unknown', message: 'boom' } },
    { model: 'gpt-5', cost_micros: 30000 },
  ]);
  assert.equal(out, 'claude-sonnet-5: ERROR (unknown)\ngpt-5: 3.00c provider cost');
});

test('renderProposerBreakdown: missing cost_micros defaults to 0.00c; empty input → empty string', () => {
  assert.equal(renderProposerBreakdown([{ model: 'm' }]), 'm: 0.00c provider cost');
  assert.equal(renderProposerBreakdown([]), '');
  assert.equal(renderProposerBreakdown(undefined), '');
});

test('renderSkipped: absent / empty → empty string (byte-identical to before)', () => {
  assert.equal(renderSkipped(undefined), '');
  assert.equal(renderSkipped([]), '');
  assert.equal(renderSkipped(null), '');
  assert.equal(renderSkipped('not-an-array'), '');
});

test('renderSkipped: string members and {model,reason} objects both render', () => {
  const out = renderSkipped([
    'llama-3.1-8b',
    { model: 'gpt-4o', reason: 'non-vision' },
    { model: 'slow-flagship', reason: 'timeout' },
    { model: 'nameless' },
  ]);
  assert.match(out, /Not counted in this consensus \(4\)/);
  assert.match(out, /llama-3\.1-8b/);
  assert.match(out, /gpt-4o \(non-vision\)/);
  assert.match(out, /slow-flagship \(timeout\)/);
  assert.match(out, /only the members that actually returned/);
});

test('renderSkipped: junk entries are filtered out', () => {
  assert.equal(renderSkipped([null, 0, '', {}]), '\n⚠️ Not counted in this consensus (1): (unknown) — the verdict reflects only the members that actually returned.');
});

test('maxTokensAdvisory: warns only above the judge synthesis cap', () => {
  assert.equal(maxTokensAdvisory(JUDGE_MAX_OUTPUT_TOKENS), ''); // at the cap → no warning
  assert.equal(maxTokensAdvisory(1024), '');
  assert.equal(maxTokensAdvisory(undefined), '');
  assert.equal(maxTokensAdvisory('16384'), ''); // non-number
  const warn = maxTokensAdvisory(16384);
  assert.match(warn, /exceeds the judge's 8192-token synthesis/);
  assert.match(warn, /truncate silently/);
});
