// Rendering a billing refusal for an AGENT (subscription system, Task 7).
//
// The consumer of this string is a coding agent in a loop, and the failure mode
// that costs real money is not a confusing sentence — it is a RETRY. An agent
// that reads "Error: Tokonomix API 402: Insufficient balance" has no way to
// know whether waiting helps, whether topping up helps, or whether it should
// stop; the reasonable default for an autonomous loop is to try again, and it
// will do so until something else stops it.
//
// So each of these strings has to carry three things: what happened, what the
// HUMAN can do about it, and an explicit instruction not to retry. The tests
// below assert those three, not the prose.
//
// The two cases must also stay DISTINGUISHABLE, because their advice is
// opposite: a 402 says "buy something", a window 429 says "buying changes
// nothing, wait". Telling an agent to top up during a closed window would make
// it spend its human's money on capacity it cannot use.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TokonomixApiError } from './http.js';
import { renderBillingError } from './render.js';

test('a plain 402 is NOT reworded — it keeps its existing message', () => {
  // A payg account's paywall predates the subscription system by a year. Rewriting
  // it here would be a behaviour change shipped with a DORMANT feature: no flag
  // involved, no subscription anywhere, and the `request_id` a support
  // conversation needs quietly dropped. Null means the caller's existing
  // `Error: Tokonomix API 402: … (code=…, request_id=…)` stands.
  assert.equal(
    renderBillingError(
      new TokonomixApiError(402, 'insufficient_balance', 'Tokonomix API 402: Insufficient balance.', 'r1', {
        topup_url: 'https://tokonomix.ai/topup',
      }),
    ),
    null,
  );
  // Half a context is not a context: zero remaining with no plan named, or a plan
  // with allowance still in it, are both ordinary empty wallets.
  assert.equal(
    renderBillingError(new TokonomixApiError(402, 'insufficient_balance', 'x', 'r', { allowance_remaining_cents: 0 })),
    null,
  );
  assert.equal(
    renderBillingError(
      new TokonomixApiError(402, 'insufficient_balance', 'x', 'r', {
        allowance_remaining_cents: 500,
        plan_key: 'pro_monthly',
      }),
    ),
    null,
  );
});

test('both rendered cases carry the request id', () => {
  const paywall = renderBillingError(
    new TokonomixApiError(402, 'insufficient_balance', 'x', 'req-42', {
      allowance_remaining_cents: 0,
      plan_key: 'pro_monthly',
    }),
  )!;
  const window = renderBillingError(
    new TokonomixApiError(429, 'rate_window_exhausted', 'x', 'req-43', { window: 'daily' }),
  )!;
  assert.match(paywall, /\(request_id=req-42\)$/);
  assert.match(window, /\(request_id=req-43\)$/);
});

test('an error with no request id renders without a dangling empty trailer', () => {
  const out = renderBillingError(
    new TokonomixApiError(429, 'rate_window_exhausted', 'x', undefined, { window: 'daily' }),
  )!;
  assert.doesNotMatch(out, /request_id/);
});

test('a SUBSCRIBER 402 names the reset date, both routes out, and forbids the retry', () => {
  const out = renderBillingError(
    new TokonomixApiError(402, 'insufficient_balance', 'Tokonomix API 402: Insufficient balance.', 'r1', {
      allowance_remaining_cents: 0,
      allowance_resets_at: '2026-09-01T00:00:00.000Z',
      plan_key: 'pro_monthly',
      topup_url: 'https://tokonomix.ai/topup',
      upgrade_url: 'https://tokonomix.ai/en/dashboard/billing',
    }),
  )!;
  assert.match(out, /allowance for this period is used up/i);
  assert.match(out, /2026-09-01/);
  assert.match(out, /wallet is empty/i);
  assert.match(out, /https:\/\/tokonomix\.ai\/topup/);
  assert.match(out, /https:\/\/tokonomix\.ai\/en\/dashboard\/billing/);
  assert.match(out, /Do not retry/i);
  // The advice is for the HUMAN — an agent cannot buy a plan on its own.
  assert.match(out, /Tell the user/i);
});

test('a closed WINDOW says wait, and says a top-up will not help', () => {
  const out = renderBillingError(
    new TokonomixApiError(429, 'rate_window_exhausted', 'Tokonomix API 429: window exhausted.', 'r2', {
      window: 'daily',
      resets_at: '2026-08-31T00:00:00.000Z',
    }),
  )!;
  assert.match(out, /usage window \(daily\) is exhausted/i);
  assert.match(out, /2026-08-31/);
  assert.match(out, /Wait/i);
  assert.match(out, /top-up does not lift this window/i);
});

test('the two cases never give the same advice', () => {
  const paywall = renderBillingError(
    new TokonomixApiError(402, 'insufficient_balance', 'x', 'r', {
      allowance_remaining_cents: 0,
      plan_key: 'pro_monthly',
      topup_url: 'https://t.test/u',
    }),
  )!;
  const window = renderBillingError(
    new TokonomixApiError(429, 'rate_window_exhausted', 'x', 'r', {
      window: 'weekly',
      resets_at: '2026-08-31T00:00:00.000Z',
    }),
  )!;
  assert.notEqual(paywall, window);
  // The window message must not send anyone to buy credit.
  assert.doesNotMatch(window, /https:\/\/t\.test\/u/);
});

test('it declines to render anything it is not about, so other errors keep their message', () => {
  assert.equal(renderBillingError(new TokonomixApiError(404, 'not_found', 'nope', 'r')), null);
  assert.equal(renderBillingError(new TokonomixApiError(500, 'unknown', 'boom', 'r')), null);
  assert.equal(
    renderBillingError(new TokonomixApiError(429, 'rate_limit_exceeded', 'slow down', 'r')),
    null,
    'a plain concurrency 429 is not a window stop and must not be renamed as one',
  );
  assert.equal(renderBillingError(new Error('not even an api error')), null);
});

test('a malformed date is passed through rather than rendered as Invalid Date', () => {
  const out = renderBillingError(
    new TokonomixApiError(429, 'rate_window_exhausted', 'x', 'r', {
      window: 'daily',
      resets_at: 'whenever',
    }),
  )!;
  assert.match(out, /whenever/);
  assert.doesNotMatch(out, /Invalid Date/);
});

test('a window stop with no reset time still tells the agent to wait rather than retry', () => {
  const out = renderBillingError(
    new TokonomixApiError(429, 'rate_window_exhausted', 'x', 'r', { window: 'weekly' }),
  )!;
  assert.match(out, /weekly/);
  assert.match(out, /Wait/i);
});

// ─── tokonomix_get_balance's subscription block ─────────────────────────────
//
// An agent that gates on `balance_cents` alone reads a subscriber's situation
// backwards: their spend leaves the plan allowance FIRST and only overflows to
// the wallet, so an empty wallet is not "stop" and a full one is not "covered".
// These tests pin that the block says the useful number, and that an account
// WITHOUT a subscription — every account while the system is dormant — renders
// exactly nothing, leaving the tool's output as it is today.

import { renderSubscriptionBalance } from './render.js';

const BLOCK = {
  plan_key: 'pro_monthly',
  status: 'active',
  allowance_cents: 5000,
  allowance_remaining_cents: 1250,
  allowance_pct_used: 75,
  period_end: '2026-09-01T00:00:00.000Z',
  resets_at: '2026-09-01T00:00:00.000Z',
  overage_source: 'wallet',
  windows: { daily: null, weekly: null },
};

test('renders nothing at all when there is no subscription', () => {
  assert.equal(renderSubscriptionBalance(null), '');
  assert.equal(renderSubscriptionBalance(undefined), '');
});

test('names the plan, what is left, and when it refills', () => {
  const out = renderSubscriptionBalance(BLOCK);
  assert.match(out, /pro_monthly/);
  assert.match(out, /€12\.50 left of €50\.00/);
  assert.match(out, /75% used/);
  assert.match(out, /2026-09-01/);
});

test('says where overage goes, so an empty allowance does not read as a stop', () => {
  assert.match(renderSubscriptionBalance(BLOCK), /billed to the wallet/i);
});

test('a window with headroom is reported without an alarm', () => {
  const out = renderSubscriptionBalance({
    ...BLOCK,
    windows: {
      daily: { cap_cents: 500, remaining_cents: 200, resets_at: '2026-08-31T00:00:00.000Z' },
      weekly: null,
    },
  });
  assert.match(out, /Daily window: €2\.00 left of €5\.00/);
  assert.doesNotMatch(out, /CLOSED/);
});

test('a CLOSED window says so, and says a top-up will not reopen it', () => {
  const out = renderSubscriptionBalance({
    ...BLOCK,
    windows: {
      daily: { cap_cents: 500, remaining_cents: 0, resets_at: '2026-08-31T00:00:00.000Z' },
      weekly: { cap_cents: 2000, remaining_cents: 900, resets_at: null },
    },
  });
  assert.match(out, /CLOSED/);
  assert.match(out, /top-up does not lift this window/i);
  // The weekly one still has room and must not be tarred with the same brush.
  assert.match(out, /Weekly window: €9\.00 left of €20\.00/);
});
