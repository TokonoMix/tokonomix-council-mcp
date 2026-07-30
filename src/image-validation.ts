// ─── Image input support ─────────────────────────────────────────────────────
//
// The gateway (POST /api/v1/chat/completions) accepts OpenAI-style content-part
// arrays in user messages:
//   [{ type: 'text', text: '...' }, { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,...' }}]
//
// MCP callers pass images as structured objects so they don't have to manually
// assemble data-URL strings. Each image is:
//   { data: string (raw base64, NO "data:..." prefix), media_type: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' }
//
// Constraints (mirroring the gateway):
//   - media_type: one of the four MIME types above
//   - data: raw base64 (no data-URL prefix); decoded size <5 MB
//   - count: ≤8 images per message
//   - total decoded size: ≤20 MB across all images in the request
//   - non-streaming only (the MCP server never sets stream:true; images are no-ops here)
//   - vision-capable models only — validated server-side; non-vision models in an
//     explicit council list are skipped (reported in x_council.skipped), and a
//     non-vision explicit single model gets a 400 from the gateway
//
// Council auto-selection (no models given): the gateway selects a default
// vision panel (claude-fable-5 + gemini-2.5-pro + gpt-4o class) automatically
// when images are present.

const ALLOWED_IMAGE_MEDIA_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const);

type AllowedMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

/** A single image provided by the MCP caller. */
export interface McpImage {
  /** Raw base64-encoded image data — no "data:..." prefix. */
  data: string;
  /** MIME type of the image. */
  media_type: AllowedMediaType;
}

/** Validation errors that indicate a bad caller payload (fast client-side reject). */
export class ImageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageValidationError';
  }
}

/**
 * Validate an array of MCP image objects and convert them to OpenAI content-part
 * image_url objects with inline data-URLs. Throws ImageValidationError on any
 * constraint violation. Returns an empty array when `rawImages` is absent or
 * empty (text-only call — caller should send `content: string`, not an array).
 */
export function validateAndConvertImages(
  rawImages: unknown,
): Array<{ type: 'image_url'; image_url: { url: string } }> {
  if (!rawImages) return [];
  if (!Array.isArray(rawImages)) {
    throw new ImageValidationError('images must be an array');
  }
  if (rawImages.length === 0) return [];
  if (rawImages.length > 8) {
    throw new ImageValidationError(`too many images: ${rawImages.length} (max 8 per message)`);
  }

  const parts: Array<{ type: 'image_url'; image_url: { url: string } }> = [];
  let totalDecodedBytes = 0;

  for (let i = 0; i < rawImages.length; i++) {
    const img = rawImages[i] as Record<string, unknown>;
    if (!img || typeof img !== 'object') {
      throw new ImageValidationError(`images[${i}]: must be an object with data and media_type`);
    }

    const mediaType = img.media_type;
    if (typeof mediaType !== 'string' || !ALLOWED_IMAGE_MEDIA_TYPES.has(mediaType as AllowedMediaType)) {
      throw new ImageValidationError(
        `images[${i}].media_type: must be one of image/jpeg, image/png, image/webp, image/gif — got ${JSON.stringify(mediaType)}`,
      );
    }

    const data = img.data;
    if (typeof data !== 'string' || data.trim() === '') {
      throw new ImageValidationError(`images[${i}].data: must be a non-empty base64 string (no data-URL prefix)`);
    }

    // Reject accidental data-URL pastes — the caller should strip the prefix.
    if (data.startsWith('data:')) {
      throw new ImageValidationError(
        `images[${i}].data: looks like a data-URL (starts with "data:") — strip the prefix and pass raw base64 only`,
      );
    }

    // Cheap size check: base64 string length * 0.75 ≈ decoded byte count.
    // Slightly over-estimates (ignores padding), which is intentional — stay well
    // under the 5 MB per-image limit rather than allowing right-at-edge payloads.
    const approxDecodedBytes = Math.ceil(data.length * 0.75);
    const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
    if (approxDecodedBytes > MAX_IMAGE_BYTES) {
      throw new ImageValidationError(
        `images[${i}]: decoded size ~${(approxDecodedBytes / (1024 * 1024)).toFixed(1)} MB exceeds the 5 MB per-image limit`,
      );
    }

    totalDecodedBytes += approxDecodedBytes;
    const MAX_TOTAL_BYTES = 20 * 1024 * 1024; // 20 MB
    if (totalDecodedBytes > MAX_TOTAL_BYTES) {
      throw new ImageValidationError(
        `images total decoded size ~${(totalDecodedBytes / (1024 * 1024)).toFixed(1)} MB exceeds the 20 MB per-request limit`,
      );
    }

    parts.push({
      type: 'image_url',
      image_url: { url: `data:${mediaType as string};base64,${data}` },
    });
  }

  return parts;
}

/**
 * Build the `content` value for the user message. When images are present,
 * returns an OpenAI-style content-part array (text part first, then image
 * parts). When there are no images, returns a plain string — keeping the wire
 * format identical to existing text-only calls so non-vision server paths
 * are unaffected.
 */
export function buildUserContent(
  prompt: string,
  imageParts: Array<{ type: 'image_url'; image_url: { url: string } }>,
): string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> {
  if (imageParts.length === 0) return prompt;
  return [
    { type: 'text' as const, text: prompt },
    ...imageParts,
  ];
}
