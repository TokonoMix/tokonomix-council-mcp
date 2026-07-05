// Unit tests for the conservative base-URL guard (INT-2125, Part B). The guard
// is applied to BASE_URL/SITE_BASE at startup (see http.ts) — these tests
// exercise the pure validator directly so they don't depend on process env at
// module-load time.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertSafeBaseUrl } from './base-url-guard.js';

const ENV_KEY = 'TOKONOMIX_ALLOW_LOCAL';

/** Run `fn` with TOKONOMIX_ALLOW_LOCAL unset/absent, restoring the previous
 *  value afterwards (some CI/dev shells may already export it). */
function withoutAllowLocal<T>(fn: () => T): T {
  const prev = process.env[ENV_KEY];
  delete process.env[ENV_KEY];
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = prev;
  }
}

function withAllowLocal<T>(fn: () => T): T {
  const prev = process.env[ENV_KEY];
  process.env[ENV_KEY] = '1';
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = prev;
  }
}

test('http:// is rejected (https-only hard requirement)', () => {
  withoutAllowLocal(() => {
    assert.throws(
      () => assertSafeBaseUrl('http://tokonomix.ai/api/v1', 'TOKONOMIX_BASE_URL'),
      /must use https/,
    );
  });
});

test('the production default https origin is allowed', () => {
  withoutAllowLocal(() => {
    assert.doesNotThrow(() => assertSafeBaseUrl('https://tokonomix.ai/api/v1', 'TOKONOMIX_BASE_URL'));
  });
});

test('localhost is rejected without TOKONOMIX_ALLOW_LOCAL', () => {
  withoutAllowLocal(() => {
    assert.throws(
      () => assertSafeBaseUrl('https://localhost:3001/api/v1', 'TOKONOMIX_BASE_URL'),
      /loopback\/private\/metadata host/,
    );
  });
});

test('localhost is allowed with TOKONOMIX_ALLOW_LOCAL=1', () => {
  withAllowLocal(() => {
    assert.doesNotThrow(() => assertSafeBaseUrl('https://localhost:3001/api/v1', 'TOKONOMIX_BASE_URL'));
  });
});

test('a private IP host (10.x) is rejected without the opt-in', () => {
  withoutAllowLocal(() => {
    assert.throws(
      () => assertSafeBaseUrl('https://10.0.0.5/api/v1', 'TOKONOMIX_BASE_URL'),
      /loopback\/private\/metadata host/,
    );
  });
});

test('a private IP host (10.x) is allowed with TOKONOMIX_ALLOW_LOCAL=1', () => {
  withAllowLocal(() => {
    assert.doesNotThrow(() => assertSafeBaseUrl('https://10.0.0.5/api/v1', 'TOKONOMIX_BASE_URL'));
  });
});

test('cloud-metadata host (169.254.169.254) is rejected without the opt-in', () => {
  withoutAllowLocal(() => {
    assert.throws(
      () => assertSafeBaseUrl('https://169.254.169.254/api/v1', 'TOKONOMIX_BASE_URL'),
      /loopback\/private\/metadata host/,
    );
  });
});

test('a custom self-hosted https origin is allowed (warn, never throw)', () => {
  withoutAllowLocal(() => {
    const originalError = console.error;
    let warned = false;
    console.error = (...args: unknown[]) => {
      warned = true;
      void args;
    };
    try {
      assert.doesNotThrow(() => assertSafeBaseUrl('https://my-selfhost.example.com/api/v1', 'TOKONOMIX_BASE_URL'));
    } finally {
      console.error = originalError;
    }
    assert.equal(warned, true, 'expected a stderr warning for a non-canonical origin');
  });
});

test('an invalid URL string throws a clear error naming the env var', () => {
  assert.throws(
    () => assertSafeBaseUrl('not-a-url', 'TOKONOMIX_SITE_URL'),
    /TOKONOMIX_SITE_URL/,
  );
});
