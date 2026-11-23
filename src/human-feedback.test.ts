// Unit tests for the pure request-builder behind tokonomix_relay_human_feedback.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildHumanFeedbackBody, describeRelayFailure } from './human-feedback.js';

test('valid input builds the expected request_id + body', () => {
  const { request_id, body } = buildHumanFeedbackBody({ request_id: 'abc-123', choice: 3 });
  assert.equal(request_id, 'abc-123');
  assert.deepEqual(body, { state: 'rated', choice: 3 });
});

test('missing request_id throws', () => {
  assert.throws(() => buildHumanFeedbackBody({ choice: 3 }), /request_id is required/);
});

test('blank request_id throws', () => {
  assert.throws(() => buildHumanFeedbackBody({ request_id: '   ', choice: 3 }), /request_id is required/);
});

test('choice=0 throws (below range)', () => {
  assert.throws(
    () => buildHumanFeedbackBody({ request_id: 'abc', choice: 0 }),
    /choice must be an integer between 1 and 5/,
  );
});

test('choice=6 throws (above range)', () => {
  assert.throws(
    () => buildHumanFeedbackBody({ request_id: 'abc', choice: 6 }),
    /choice must be an integer between 1 and 5/,
  );
});

test('non-integer choice throws', () => {
  assert.throws(
    () => buildHumanFeedbackBody({ request_id: 'abc', choice: 2.5 }),
    /choice must be an integer between 1 and 5/,
  );
});

test('missing choice throws', () => {
  assert.throws(
    () => buildHumanFeedbackBody({ request_id: 'abc' }),
    /choice must be an integer between 1 and 5/,
  );
});

test('free_text is trimmed and included when present', () => {
  const { body } = buildHumanFeedbackBody({ request_id: 'abc', choice: 1, free_text: '  it caught a real bug  ' });
  assert.equal(body.free_text, 'it caught a real bug');
});

test('free_text is capped at 2000 chars', () => {
  const long = 'x'.repeat(2500);
  const { body } = buildHumanFeedbackBody({ request_id: 'abc', choice: 1, free_text: long });
  assert.equal((body.free_text as string).length, 2000);
});

test('free_text omitted when absent from input', () => {
  const { body } = buildHumanFeedbackBody({ request_id: 'abc', choice: 1 });
  assert.equal('free_text' in body, false);
});

test('free_text omitted when empty/whitespace-only', () => {
  const { body } = buildHumanFeedbackBody({ request_id: 'abc', choice: 1, free_text: '   ' });
  assert.equal('free_text' in body, false);
});

// ─── describeRelayFailure — the three 404 causes (INT-2502) ───────────────────
//
// The relay endpoint answers several distinct causes with a 404. Only one of them
// ("the relay is switched off") is a fact the server actually states; the other two
// are deliberately indistinguishable so nobody can probe whether someone else's
// request_id exists. These tests pin both halves of that contract.

/** Build the error tokonomixFetch throws, without importing the http layer. */
function apiError(status: number, code: string): Error {
  const e = new Error(
    `Tokonomix API ${status}: Not found. (code=${code}, request_id=req-1)`,
  ) as Error & { status: number; code: string };
  e.status = status;
  e.code = code;
  return e;
}

test('cause 1 — flag off: relay_disabled is reported as dormant', () => {
  const msg = describeRelayFailure(apiError(404, 'relay_disabled'));
  assert.match(String(msg), /switched off/i);
  assert.match(String(msg), /DORMANT/);
  assert.match(String(msg), /Nothing was recorded/i);
});

test('cause 2 — unknown request_id: honest message, never claims dormant', () => {
  const msg = describeRelayFailure(apiError(404, 'not_found'));
  assert.match(String(msg), /not found under the API key/i);
  assert.doesNotMatch(String(msg), /switched off/i);
});

test('cause 3 — ownership mismatch: points at the key, never claims dormant', () => {
  const msg = describeRelayFailure(apiError(404, 'not_found'));
  assert.match(String(msg), /same key that made the original call/i);
  assert.doesNotMatch(String(msg), /switched off/i);
});

test('no info leak: unknown request_id and wrong owner are byte-identical', () => {
  // The server sends the same code for both, so the client cannot — and must not —
  // tell an agent whether a request_id it does not own exists.
  const unknownId = describeRelayFailure(apiError(404, 'not_found'));
  const wrongOwner = describeRelayFailure(apiError(404, 'not_found'));
  assert.equal(unknownId, wrongOwner);
  assert.doesNotMatch(String(unknownId), /exists|belongs to|another account|other user/i);
});

test('older gateway without the distinct code falls back to the honest message', () => {
  // Pre-INT-2502 gateways answer every cause with `not_found`; a client talking to
  // one must degrade to the truthful message, not to the old DORMANT claim.
  const legacy = new Error('Tokonomix API 404: Not found. (code=not_found, request_id=req-1)');
  const msg = describeRelayFailure(legacy);
  assert.match(String(msg), /not found under the API key/i);
  assert.match(String(msg), /older gateway/i);
});

test('non-404 errors return null so the caller rethrows', () => {
  assert.equal(describeRelayFailure(apiError(500, 'internal_error')), null);
  assert.equal(describeRelayFailure(apiError(401, 'unauthorized')), null);
  assert.equal(describeRelayFailure(new Error('network down')), null);
  assert.equal(describeRelayFailure('not an error'), null);
});
