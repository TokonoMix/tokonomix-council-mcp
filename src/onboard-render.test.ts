/**
 * 2026-08-03 Claude Security scan, F18.
 *
 * The onboard_verify tool result used to interpolate the raw `tok_live_` key.
 * An MCP tool result is not a private channel: the host appends it to the
 * conversation, ships it to the model provider on the next turn, and persists
 * it to a plaintext session log. That contradicted the package's own claim in
 * README.md ("The key is never logged") and put a long-lived, billing-capable
 * credential into files people attach to bug reports.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maskApiKey } from './credentials.js';
import { renderOnboardVerifySuccess } from './render.js';

// Deliberately unmistakable as a fixture: a 32-hex fixture reads exactly like a
// live key, which is both against our own test-data rule and enough to trip the
// secret-scan in scripts/publish-public-repos.sh and block the public mirror.
const RAW = 'tok_live_deadbeefdeadbeefdeadbeefdeadbeef';

test('maskApiKey keeps only the prefix and the last four characters', () => {
  assert.equal(maskApiKey(RAW), 'tok_live_…beef');
});

test('maskApiKey never returns the full key, for any shape of input', () => {
  for (const input of [RAW, 'tok_live_short', 'tok_test_abcdefghijklmnop', 'no-prefix-at-all-here', '', 'x']) {
    const masked = maskApiKey(input);
    assert.notEqual(masked, input, `maskApiKey passed ${JSON.stringify(input)} through unchanged`);
    assert.ok(masked.includes('…'), 'a masked key must be visibly elided');
  }
});

test('a key too short to elide safely reveals nothing but its prefix', () => {
  assert.equal(maskApiKey('tok_live_short'), 'tok_live_…');
});

test('the onboard_verify tool result does not contain the raw key', () => {
  const text = renderOnboardVerifySuccess({
    email: 'new@example.com',
    rawKey: RAW,
    creditsEur: '2.50',
    approxCalls: 40,
    credentialsFile: '/home/someone/.tokonomix/credentials.json',
    dashboardUrl: 'https://tokonomix.ai/en/dashboard',
    setPasswordUrl: 'https://tokonomix.ai/en/set-password',
    alreadyExisted: false,
  });

  assert.ok(!text.includes(RAW), 'raw key leaked into the tool result');
  // The secret suffix must not appear either — a partial is still a partial.
  assert.ok(!text.includes('9f3c1d7e4b2a8c6d5e0f1a2b3c4d5e6f'));
});

test('it still tells the user everything they need to act', () => {
  const text = renderOnboardVerifySuccess({
    email: 'new@example.com',
    rawKey: RAW,
    creditsEur: '2.50',
    approxCalls: 40,
    credentialsFile: '/home/someone/.tokonomix/credentials.json',
    dashboardUrl: 'https://tokonomix.ai/en/dashboard',
    setPasswordUrl: 'https://tokonomix.ai/en/set-password',
    alreadyExisted: false,
  });

  assert.ok(text.includes('new@example.com'));
  assert.ok(text.includes('tok_live_…beef'), 'the masked identifier helps the user recognise the key');
  assert.ok(text.includes('/home/someone/.tokonomix/credentials.json'));
  assert.ok(text.includes('2.50'));
  assert.ok(text.includes('https://tokonomix.ai/en/dashboard'));
  assert.ok(text.includes('https://tokonomix.ai/en/set-password'));
});

test('the overwrite warning still fires when a previous file existed', () => {
  const base = {
    email: 'new@example.com',
    rawKey: RAW,
    creditsEur: '2.50',
    approxCalls: 40,
    credentialsFile: '/home/someone/.tokonomix/credentials.json',
    dashboardUrl: 'https://tokonomix.ai/en/dashboard',
    setPasswordUrl: 'https://tokonomix.ai/en/set-password',
  };
  assert.ok(renderOnboardVerifySuccess({ ...base, alreadyExisted: true }).includes('overwritten'));
  assert.ok(!renderOnboardVerifySuccess({ ...base, alreadyExisted: false }).includes('overwritten'));
});
