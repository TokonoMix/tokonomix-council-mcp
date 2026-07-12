// Unit tests for the pure request-builder behind tokonomix_relay_human_feedback.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildHumanFeedbackBody } from './human-feedback.js';

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
