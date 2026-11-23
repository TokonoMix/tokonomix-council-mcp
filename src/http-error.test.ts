// Regression tests for TokonomixApiError (INT-2502).
//
// tokonomixFetch used to throw a plain Error whose message was the ONLY carrier of
// information. It now throws a subclass with `status`/`code` so callers can branch on
// which error the gateway sent instead of guessing from the status. That is only safe
// if the subclass is a drop-in: several call sites still sniff the message string, and
// the errors cross an MCP JSON boundary. These tests pin that contract.
//
// A council review (2026-07-28) disagreed on whether the custom fields survive
// JSON.stringify — one model said they are dropped as non-enumerable. Measured here:
// they are enumerable own properties and do survive. The test exists so that answer
// stays measured rather than argued.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TokonomixApiError } from './http.js';

function sample(): TokonomixApiError {
  return new TokonomixApiError(
    404,
    'relay_disabled',
    'Tokonomix API 404: Not found. (code=relay_disabled, request_id=req-1)',
    'req-1',
  );
}

test('is a real Error, so every `instanceof Error` guard keeps working', () => {
  assert.ok(sample() instanceof Error);
  assert.ok(sample() instanceof TokonomixApiError);
});

test('message is unchanged, so legacy `message.includes(...)` checks keep working', () => {
  assert.ok(sample().message.includes('Tokonomix API 404'));
  assert.ok(sample().message.includes('code=relay_disabled'));
});

test('status, code and requestId are readable', () => {
  const e = sample();
  assert.equal(e.status, 404);
  assert.equal(e.code, 'relay_disabled');
  assert.equal(e.requestId, 'req-1');
});

test('the machine-readable fields survive JSON encoding', () => {
  const encoded = JSON.parse(JSON.stringify(sample())) as Record<string, unknown>;
  assert.equal(encoded.status, 404);
  assert.equal(encoded.code, 'relay_disabled');
});

test('a body with no error.code degrades to "unknown" rather than undefined', () => {
  const e = new TokonomixApiError(500, 'unknown', 'Tokonomix API 500: boom (code=unknown, request_id=-)');
  assert.equal(e.code, 'unknown');
  assert.equal(e.requestId, undefined);
});
