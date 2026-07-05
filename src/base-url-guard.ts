// ─── Base-URL guard ───────────────────────────────────────────────────────────
//
// Defense-in-depth against an accidentally or maliciously redirected gateway
// (e.g. a poisoned TOKONOMIX_BASE_URL / TOKONOMIX_SITE_URL env var pointing the
// client's Bearer-token-bearing requests at an attacker-controlled or internal
// host). Applied once, at startup, to the resolved BASE_URL and SITE_BASE.
//
// Policy (intentionally asymmetric):
//   - https-only is a HARD requirement — any non-https origin throws. The
//     shipped default is https, so nobody running the client unmodified is
//     affected; anyone who was pointing it at http:// was already insecure.
//   - loopback / private-network / cloud-metadata hosts are REJECTED unless the
//     caller explicitly opts in with TOKONOMIX_ALLOW_LOCAL=1 (local dev / a
//     local reverse proxy). Without the opt-in this is almost always either a
//     misconfiguration or a redirect attack, never a legitimate production use.
//   - any OTHER https origin (i.e. not the canonical tokonomix.ai) is only
//     WARNED about, never blocked. This is a published client with self-hosted
//     users — hard-blocking custom origins would break a supported use case, so
//     the guard trades a bit of silence for never bricking a legitimate
//     self-host deployment. The warning still gives an operator a signal to
//     double-check an origin they didn't expect.

const DEFAULT_GATEWAY_HOST = 'tokonomix.ai';

/** Literal hostname check for loopback / RFC1918-private / link-local /
 *  cloud-metadata ranges. No DNS resolution — this only catches the literal
 *  hostname/IP as given in the URL (which is the redirect-attack surface: an
 *  env var set to a private address), not a hostname that merely *resolves*
 *  to one. */
function isPrivateOrLoopbackHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h === '0.0.0.0' || h === '::1' || h === '::') return true;
  if (/^127\./.test(h)) return true; // 127.0.0.0/8 (loopback)
  if (/^10\./.test(h)) return true; // 10.0.0.0/8 (private)
  if (/^192\.168\./.test(h)) return true; // 192.168.0.0/16 (private)
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true; // 172.16.0.0/12 (private)
  if (/^169\.254\./.test(h)) return true; // 169.254.0.0/16 (link-local + cloud metadata, e.g. 169.254.169.254)
  if (/^f[cd][0-9a-f]{2}:/.test(h)) return true; // fc00::/7 (IPv6 unique-local)
  if (/^fe[89ab][0-9a-f]:/.test(h)) return true; // fe80::/10 (IPv6 link-local)
  return false;
}

/**
 * Validate a resolved base URL (BASE_URL or SITE_BASE) before it is used for
 * any outbound request. Throws on a hard violation (non-https, or a private/
 * loopback host without the opt-in); prints a one-line stderr warning (never
 * throws) for a non-canonical-but-otherwise-valid https origin.
 *
 * @param rawUrl      the resolved URL string to validate
 * @param envVarLabel the env var name to name in error/warning messages
 *                     (e.g. "TOKONOMIX_BASE_URL") — purely for a clear message,
 *                     does not affect validation logic
 */
export function assertSafeBaseUrl(rawUrl: string, envVarLabel: string): void {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`${envVarLabel} is not a valid URL: ${JSON.stringify(rawUrl)}`);
  }

  if (parsed.protocol !== 'https:') {
    throw new Error(
      `${envVarLabel} must use https:// — got "${parsed.protocol}//${parsed.host}". ` +
        'Plaintext http:// is not supported. If you need a local/self-hosted target, ' +
        'use an https:// origin and set TOKONOMIX_ALLOW_LOCAL=1 if it is a loopback/private host.',
    );
  }

  const hostname = parsed.hostname;
  const allowLocal = process.env.TOKONOMIX_ALLOW_LOCAL === '1';
  if (isPrivateOrLoopbackHost(hostname) && !allowLocal) {
    throw new Error(
      `${envVarLabel} points at a loopback/private/metadata host ("${hostname}"), which is refused by ` +
        'default (defense-in-depth against an accidentally or maliciously redirected gateway). ' +
        'Set TOKONOMIX_ALLOW_LOCAL=1 to opt in for local development.',
    );
  }

  if (hostname.toLowerCase() !== DEFAULT_GATEWAY_HOST) {
    console.error(
      `[tokonomix-council-mcp] WARN: using non-default gateway origin "${hostname}" (via ${envVarLabel}). ` +
        'Expected for self-hosted deployments — verify this is the origin you intend.',
    );
  }
}
