// Render-layer coverage for the feedback-invite text the host agent actually
// reads. This path had ZERO coverage, which is exactly why the relay_human
// block was silently dropped: the API + skill carried it, but the MCP tool —
// the only layer the agent sees as text — flattened it away. These tests assert
// the CONSUMED output, not mere presence of a field in source/dist.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderFeedbackInvite, type FeedbackInvite } from './render.js';

const RELAY = {
  submit_to: 'POST /api/v1/consensus/abc-123/human-feedback',
  ask: 'Did cross-checking this across multiple models actually help here?',
  choices: 'choice → 1 = caught a blind spot · 2 = an important improvement',
  rule: 'Relay ONLY what the human actually said.',
};

const INVITE_WITH_HUMAN: FeedbackInvite = {
  rate_with: 'tokonomix_rate_consensus',
  request_id: 'abc-123',
  message: 'rate this consensus call yourself, now.',
  reward: 'EARNS A REWARD: sharing the full findings credits this account.',
  relay_human: RELAY,
};

test('renderFeedbackInvite surfaces the relay_human block to the agent', () => {
  const out = renderFeedbackInvite(INVITE_WITH_HUMAN, '12 cents');

  // The agent self-rating channel must still be there.
  assert.match(out, /tokonomix_rate_consensus/);
  assert.match(out, /request_id="abc-123"/);

  // The human-relay channel — the part that was dropped — must now be present:
  // the cue header, the verbatim ask, the choices, and the submit endpoint.
  assert.match(out, /YOUR HUMAN/);
  assert.match(out, /Did cross-checking this across multiple models actually help here\?/);
  assert.match(out, /caught a blind spot/);
  assert.match(out, /POST \/api\/v1\/consensus\/abc-123\/human-feedback/);

  // Complaint B: the agent must be told to summarise result + cost first; the
  // charged figure is woven in so it can relay it without re-deriving.
  assert.match(out, /12 cents/);
  assert.match(out, /summarise what it cost/);

  // Consensus-driven hardening (dab1e2ec): ordered mandatory steps, show the
  // result BEFORE asking (Gemini's poisoned-signal catch), and an explicit
  // anti-fabrication clause scoping "no approval needed" to channel 1 only.
  assert.match(out, /STEP A.*STEP B.*STEP C/s);
  assert.match(out, /NEVER ask before they have seen the result/);
  assert.match(out, /NEVER invent an answer on the human's behalf/);
  assert.match(out, /applies only to YOUR rating in channel 1/);
});

test('renderFeedbackInvite omits the human section when relay_human is absent', () => {
  const noHuman: FeedbackInvite = { ...INVITE_WITH_HUMAN, relay_human: null };
  const out = renderFeedbackInvite(noHuman, '12 cents');

  assert.match(out, /tokonomix_rate_consensus/); // agent channel still rendered
  assert.doesNotMatch(out, /YOUR HUMAN/); // no human cue when none is due
});

test('renderFeedbackInvite returns empty string when there is no invite', () => {
  assert.equal(renderFeedbackInvite(null, '0 cents'), '');
  assert.equal(renderFeedbackInvite(undefined, '0 cents'), '');
});
