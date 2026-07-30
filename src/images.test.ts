/**
 * Unit tests for image validation and content-building helpers.
 *
 * Run with:  npm test
 * (uses tsx --test which invokes Node.js test runner via tsx transpilation)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// These helpers now live in their own module (mechanical split of the former
// single-file index.ts, INT-2125) — imported directly so this test never has
// to worry about index.ts's runnable main() bootstrap.
import {
  validateAndConvertImages,
  buildUserContent,
  ImageValidationError,
} from './image-validation.js';

// ─── Small helpers ───────────────────────────────────────────────────────────

/** Produce a base64 string representing `byteCount` bytes (ASCII 'A'). */
function makeBase64(byteCount: number): string {
  // base64 encodes 3 bytes → 4 chars; we pad to a full multiple of 3.
  const buf = Buffer.alloc(byteCount, 0x41); // 0x41 = 'A'
  return buf.toString('base64');
}

/** 1-byte tiny JPEG (valid base64, tiny payload). */
const TINY_BASE64 = makeBase64(1);

// ─── validateAndConvertImages ────────────────────────────────────────────────

describe('validateAndConvertImages', () => {
  test('returns empty array for undefined input', () => {
    assert.deepEqual(validateAndConvertImages(undefined), []);
  });

  test('returns empty array for null input', () => {
    assert.deepEqual(validateAndConvertImages(null), []);
  });

  test('returns empty array for empty array', () => {
    assert.deepEqual(validateAndConvertImages([]), []);
  });

  test('converts a single valid image to an image_url content part', () => {
    const result = validateAndConvertImages([
      { data: TINY_BASE64, media_type: 'image/png' },
    ]);
    assert.equal(result.length, 1);
    assert.equal(result[0].type, 'image_url');
    assert.equal(result[0].image_url.url, `data:image/png;base64,${TINY_BASE64}`);
  });

  test('converts all four allowed media types', () => {
    const types = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
    for (const mt of types) {
      const result = validateAndConvertImages([{ data: TINY_BASE64, media_type: mt }]);
      assert.equal(result[0].image_url.url, `data:${mt};base64,${TINY_BASE64}`);
    }
  });

  test('accepts exactly 8 images without error', () => {
    const images = Array.from({ length: 8 }, () => ({
      data: TINY_BASE64,
      media_type: 'image/jpeg' as const,
    }));
    const result = validateAndConvertImages(images);
    assert.equal(result.length, 8);
  });

  test('rejects non-array input', () => {
    assert.throws(
      () => validateAndConvertImages('not-an-array'),
      (err: unknown) => err instanceof ImageValidationError && /must be an array/.test((err as Error).message),
    );
  });

  test('rejects more than 8 images', () => {
    const images = Array.from({ length: 9 }, () => ({
      data: TINY_BASE64,
      media_type: 'image/jpeg' as const,
    }));
    assert.throws(
      () => validateAndConvertImages(images),
      (err: unknown) => err instanceof ImageValidationError && /too many images/.test((err as Error).message),
    );
  });

  test('rejects unsupported media_type', () => {
    assert.throws(
      () => validateAndConvertImages([{ data: TINY_BASE64, media_type: 'image/bmp' }]),
      (err: unknown) => err instanceof ImageValidationError && /media_type/.test((err as Error).message),
    );
  });

  test('rejects missing media_type', () => {
    assert.throws(
      () => validateAndConvertImages([{ data: TINY_BASE64 }]),
      (err: unknown) => err instanceof ImageValidationError && /media_type/.test((err as Error).message),
    );
  });

  test('rejects empty data string', () => {
    assert.throws(
      () => validateAndConvertImages([{ data: '', media_type: 'image/jpeg' }]),
      (err: unknown) => err instanceof ImageValidationError && /data/.test((err as Error).message),
    );
  });

  test('rejects data-URL prefix in data field', () => {
    assert.throws(
      () => validateAndConvertImages([
        { data: 'data:image/jpeg;base64,/9j/abc', media_type: 'image/jpeg' },
      ]),
      (err: unknown) => err instanceof ImageValidationError && /data-URL/.test((err as Error).message),
    );
  });

  test('rejects a single image exceeding 5 MB decoded', () => {
    // ~5.1 MB of raw bytes → base64 expands to ~6.8 MB string, decoded ≈ 5.1 MB
    const oversized = makeBase64(5 * 1024 * 1024 + 1024);
    assert.throws(
      () => validateAndConvertImages([{ data: oversized, media_type: 'image/jpeg' }]),
      (err: unknown) => err instanceof ImageValidationError && /5 MB/.test((err as Error).message),
    );
  });

  test('accepts an image just under the 5 MB decoded boundary', () => {
    // Locks the boundary from the accept side: a regression treating the
    // base64 STRING length as decoded bytes would reject ~4.5 MB images.
    const justUnder = makeBase64(Math.floor(4.5 * 1024 * 1024));
    const parts = validateAndConvertImages([{ data: justUnder, media_type: 'image/jpeg' }]);
    assert.equal(parts.length, 1);
  });

  test('rejects total size exceeding 20 MB across multiple images', () => {
    // Six images of ~3.5 MB each — each individually under the 5 MB limit,
    // but combined ≈ 21 MB which exceeds the 20 MB total limit.
    // 3.5 MB * 6 = 21 MB > 20 MB limit; 3.5 MB < 5 MB per-image limit.
    const nearMax = makeBase64(Math.floor(3.5 * 1024 * 1024));
    const images = Array.from({ length: 6 }, () => ({
      data: nearMax,
      media_type: 'image/jpeg' as const,
    }));
    assert.throws(
      () => validateAndConvertImages(images),
      (err: unknown) => err instanceof ImageValidationError && /20 MB/.test((err as Error).message),
    );
  });

  test('rejects non-object item in array', () => {
    assert.throws(
      () => validateAndConvertImages(['not-an-object']),
      (err: unknown) => err instanceof ImageValidationError,
    );
  });
});

// ─── buildUserContent ────────────────────────────────────────────────────────

describe('buildUserContent', () => {
  test('returns plain string when there are no image parts', () => {
    const result = buildUserContent('hello world', []);
    assert.equal(typeof result, 'string');
    assert.equal(result, 'hello world');
  });

  test('returns content-part array when images are present', () => {
    const imageParts = [
      { type: 'image_url' as const, image_url: { url: 'data:image/png;base64,abc' } },
    ];
    const result = buildUserContent('describe this', imageParts);
    assert.ok(Array.isArray(result));
    const parts = result as Array<{ type: string }>;
    assert.equal(parts[0].type, 'text');
    assert.equal((parts[0] as { type: 'text'; text: string }).text, 'describe this');
    assert.equal(parts[1].type, 'image_url');
  });

  test('places the text part first, then all image parts in order', () => {
    const imageParts = [
      { type: 'image_url' as const, image_url: { url: 'data:image/jpeg;base64,aaa' } },
      { type: 'image_url' as const, image_url: { url: 'data:image/png;base64,bbb' } },
    ];
    const result = buildUserContent('two images', imageParts) as Array<{ type: string }>;
    assert.equal(result.length, 3);
    assert.equal(result[0].type, 'text');
    assert.equal(result[1].type, 'image_url');
    assert.equal(result[2].type, 'image_url');
    assert.equal(
      (result[1] as { type: 'image_url'; image_url: { url: string } }).image_url.url,
      'data:image/jpeg;base64,aaa',
    );
    assert.equal(
      (result[2] as { type: 'image_url'; image_url: { url: string } }).image_url.url,
      'data:image/png;base64,bbb',
    );
  });
});
