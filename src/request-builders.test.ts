import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMessages, buildConsensusBody, buildSingleBody } from './request-builders.js';

// The transparency property (SECURITY.md / README §3): a consensus call sends
// ONLY these top-level keys, everything council-specific rides in x_council.
const ALLOWED_CONSENSUS_KEYS = new Set(['model', 'messages', 'x_council', 'max_tokens']);
const ALLOWED_SINGLE_KEYS = new Set(['model', 'messages', 'max_tokens']);

test('buildMessages: user only when no system', () => {
  const m = buildMessages({}, 'hello');
  assert.deepEqual(m, [{ role: 'user', content: 'hello' }]);
});

test('buildMessages: system prepended only when a non-empty string', () => {
  assert.deepEqual(buildMessages({ system: 'be terse' }, 'q'), [
    { role: 'system', content: 'be terse' },
    { role: 'user', content: 'q' },
  ]);
  // empty/blank/non-string system is dropped
  assert.equal(buildMessages({ system: '' }, 'q').length, 1);
  assert.equal(buildMessages({ system: 42 }, 'q').length, 1);
});

test('buildConsensusBody: bare prompt → only model + messages, no x_council, no max_tokens', () => {
  const body = buildConsensusBody({ prompt: 'x' }, 'x');
  assert.equal(body.model, 'tokonomix-consensus');
  assert.ok(Array.isArray(body.messages));
  assert.equal('x_council' in body, false);
  assert.equal('max_tokens' in body, false);
});

test('buildConsensusBody: council params ride inside x_council', () => {
  const body = buildConsensusBody(
    {
      mode: 'full',
      models: ['gpt-5', 'gemini-2.5-pro'],
      judge_model: 'claude-haiku-4-5-20251001',
      judge_models: ['a', 'b'],
      context: { inline: [{ content: 'code here', path: 'a.ts' }] },
      request_id: 'req-123',
      acknowledge_ungrounded: true,
      acknowledge_reason: 'general question',
      max_tokens: 2048,
    },
    'x',
  );
  const xc = body.x_council as Record<string, unknown>;
  assert.equal(xc.mode, 'full');
  assert.deepEqual(xc.models, ['gpt-5', 'gemini-2.5-pro']);
  assert.equal(xc.judge_model, 'claude-haiku-4-5-20251001');
  assert.deepEqual(xc.judge_models, ['a', 'b']);
  assert.equal(xc.continuation_id, 'req-123'); // request_id maps to continuation_id
  assert.equal(xc.acknowledge_ungrounded, true);
  assert.equal(xc.acknowledge_reason, 'general question');
  assert.ok(xc.context, 'inline context is normalized onto x_council.context');
  assert.equal(body.max_tokens, 2048);
});

test('buildConsensusBody: empty model/judge arrays are omitted from x_council', () => {
  const body = buildConsensusBody({ models: [], judge_models: [], mode: 'consensus' }, 'x');
  const xc = body.x_council as Record<string, unknown>;
  assert.equal('models' in xc, false);
  assert.equal('judge_models' in xc, false);
  assert.equal(xc.mode, 'consensus');
});

test('buildConsensusBody: max_tokens only accepted as a number', () => {
  assert.equal('max_tokens' in buildConsensusBody({ max_tokens: '2048' }, 'x'), false);
  assert.equal(buildConsensusBody({ max_tokens: 1024 }, 'x').max_tokens, 1024);
});

test('TRANSPARENCY: no unexpected top-level fields leak onto the consensus body', () => {
  // Kitchen-sink args including junk the caller must NOT be able to smuggle onto
  // the wire (stream, temperature, telemetry, arbitrary keys).
  const body = buildConsensusBody(
    {
      prompt: 'x',
      mode: 'diff',
      models: ['gpt-5'],
      judge_model: 'j',
      context: { inline: [{ content: 'c' }] },
      max_tokens: 100,
      stream: true,
      temperature: 0.9,
      telemetry: { pii: 'leak' },
      foo: 'bar',
      model: 'attacker-override',
    },
    'x',
  );
  for (const k of Object.keys(body)) {
    assert.ok(ALLOWED_CONSENSUS_KEYS.has(k), `unexpected top-level key on consensus body: ${k}`);
  }
  // caller cannot override the fixed consensus model
  assert.equal(body.model, 'tokonomix-consensus');
});

test('buildSingleBody: model + messages, optional max_tokens, never x_council', () => {
  const body = buildSingleBody({ max_tokens: 512, models: ['x'], mode: 'consensus' }, 'hi', 'gpt-5');
  assert.equal(body.model, 'gpt-5');
  assert.ok(Array.isArray(body.messages));
  assert.equal(body.max_tokens, 512);
  assert.equal('x_council' in body, false);
  for (const k of Object.keys(body)) {
    assert.ok(ALLOWED_SINGLE_KEYS.has(k), `unexpected top-level key on single body: ${k}`);
  }
});

test('buildSingleBody: non-number max_tokens omitted', () => {
  assert.equal('max_tokens' in buildSingleBody({ max_tokens: null }, 'hi', 'm'), false);
});
