import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderSubstitutions, renderWarnings } from './render.js';

// INT-2871. The gateway has reported substitutions since INT-1720 and no MCP
// tool ever showed them, so asking for one model and being served another was
// indistinguishable from success. These tests pin the shape the agent sees.

test('renderSubstitutions: names what you asked for, what you got, and why', () => {
  const out = renderSubstitutions([
    { for: 'anthropic/claude-opus-5', model: 'ovh/Qwen3.5-397B-A17B', ok: true, reason: 'empty_completion' },
  ]);
  assert.match(out, /Not the model you asked for \(1\)/);
  assert.match(out, /anthropic\/claude-opus-5 \(empty_completion\) → ovh\/Qwen3\.5-397B-A17B/);
  assert.match(out, /came from the substitute/);
});

test('renderSubstitutions: a substitute that also failed says so', () => {
  const out = renderSubstitutions([
    { for: 'ovh/gpt-oss-120b', model: 'ovh/gpt-oss-20b', ok: false, reason: 'empty_completion' },
  ]);
  assert.match(out, /→ ovh\/gpt-oss-20b — which also failed/);
});

test('renderSubstitutions: several substitutions are all listed', () => {
  const out = renderSubstitutions([
    { for: 'a/one', model: 'b/two', ok: true },
    { for: 'c/three', model: 'd/four', ok: true },
  ]);
  assert.match(out, /\(2\)/);
  assert.match(out, /a\/one → b\/two/);
  assert.match(out, /c\/three → d\/four/);
});

test('renderSubstitutions: nothing substituted → empty string (byte-identical to before)', () => {
  assert.equal(renderSubstitutions([]), '');
  assert.equal(renderSubstitutions(undefined), '');
  assert.equal(renderSubstitutions(null), '');
});

test('renderSubstitutions: junk entries are skipped, not rendered as noise', () => {
  assert.equal(renderSubstitutions(['nonsense', 42, null]), '');
});

test('renderSubstitutions: a missing field degrades to (unknown), never throws', () => {
  const out = renderSubstitutions([{ model: 'b/two', ok: true }]);
  assert.match(out, /\(unknown\) → b\/two/);
});

test('renderWarnings: gateway warnings reach the agent with their code', () => {
  const out = renderWarnings([
    { code: 'not_a_council', message: 'This was a single-model passthrough with a fallback list, not a council.' },
  ]);
  assert.match(out, /\[not_a_council\]/);
  assert.match(out, /not a council/);
});

test('renderWarnings: each warning gets its own marked line', () => {
  const out = renderWarnings([
    { code: 'a', message: 'first' },
    { code: 'b', message: 'second' },
  ]);
  assert.equal(out.split('⚠️').length - 1, 2);
});

test('renderWarnings: no warnings → empty string', () => {
  assert.equal(renderWarnings([]), '');
  assert.equal(renderWarnings(undefined), '');
});

test('renderWarnings: a message-less entry still shows its code rather than vanishing', () => {
  assert.match(renderWarnings([{ code: 'model_substituted' }]), /model_substituted/);
});
