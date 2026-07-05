// consensus-integrity #03 — render-layer coverage for the council verdict block
// the host agent actually reads. DORMANT: the gateway only sends `x_council.
// verdict` when the `council_structured_verdict` flag is ON, so this renderer
// must be inert (empty string) when the block is absent — otherwise a byte
// difference would leak into every consensus call while the feature is off.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderCouncilVerdict, type CouncilVerdictBlock } from './render.js';

const VERDICT: CouncilVerdictBlock = {
  overall: 'concerns',
  issues: [
    { severity: 'high', status: 'open', title: 'missing rate limiting', file: 'api/route.ts' },
    { severity: 'low', status: 'resolved', title: 'typo in log' },
  ],
  proposers: ['model-a', 'model-b'],
  judge: 'judge-x',
};

test('absent verdict → empty string (flag-off byte-identical)', () => {
  assert.equal(renderCouncilVerdict(undefined), '');
  assert.equal(renderCouncilVerdict(null), '');
});

test('present verdict → renders overall, judge, proposers and issues', () => {
  const text = renderCouncilVerdict(VERDICT);
  assert.match(text, /Council verdict: concerns/);
  assert.match(text, /judge: judge-x/);
  assert.match(text, /proposers: model-a, model-b/);
  assert.match(text, /\[high\/open\] missing rate limiting \(api\/route\.ts\)/);
  assert.match(text, /\[low\/resolved\] typo in log/);
});

test('no issues → "none"', () => {
  const text = renderCouncilVerdict({ ...VERDICT, issues: [] });
  assert.match(text, /Issues \(judge\): none/);
});
