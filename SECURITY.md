# Security Policy

Tokonomix is a verification tool used in compliance-sensitive workflows, so we take
security reports seriously and aim to respond quickly.

## Reporting a vulnerability

**Do not open a public issue for security problems.**

Email **security@tokonomix.ai** with:

- a description of the issue and its impact,
- steps to reproduce (a minimal proof-of-concept if possible),
- the affected version (`npx tokonomix-council-mcp --version` or the npm version).

We aim to acknowledge within **2 business days** and to provide a remediation
timeline after triage. Please give us a reasonable window to fix the issue before
any public disclosure; we are happy to credit reporters who follow coordinated
disclosure.

## Scope

In scope: the `tokonomix-council-mcp` server (this package), the bundled
`tokonomix-consensus` skill, and the way they handle credentials, the local
credentials/state files (`~/.tokonomix/`), and data sent to the Tokonomix gateway.

Out of scope: third-party model providers, and issues that require a
already-compromised host or a man-in-the-middle on the user's own TLS.

## Trust boundary: the gateway is untrusted input

The MCP client runs on your host; the gateway (`tokonomix.ai` by default) is a
remote party. Everything the gateway sends back is treated as **data, never as
instructions**. Three server-supplied channels reach the agent's context, and how
each is handled:

- **Skill content** (`GET /skill`). The guiding skill is server-canonical by
  default so fixes reach every agent. It is public, key-less documentation, and
  the response is treated as untrusted input. If you want reproducible,
  vendor-independent behaviour, set **`TOKONOMIX_SKILL_PIN=bundled`**: the client
  then pins the skill to the copy shipped in your installed package, makes no
  skill network call, and refuses any server-supplied update-notice. The active
  source (`server` / `bundled` / `bundled(pinned)`) is shown on every response
  trailer, so a silent switch is visible.
- **Update-notice string.** On a server-side skill change the client may surface a
  one-time "you received a new update" notice. It is built from gateway-supplied
  strings, so before it is rendered it is stripped of control characters (C0 + DEL)
  and both its length and item count are capped. It is informational only; it is
  not an instruction to the agent, and `TOKONOMIX_SKILL_PIN=bundled` disables it.
- **`x_council` metadata and judge/verdict text.** The consensus response body
  (the synthesis, per-model text, and `x_council` block) is model/gateway output.
  Treat it as content to reason over, not as commands to execute — the same rule
  you would apply to any tool result. A compromised or malicious gateway is the
  threat model here; if you observe a gateway response trying to issue
  instructions, that is a report-worthy event (see above).

We consider a gateway that injects agent instructions through any of these
channels a security issue and want to hear about it.

## Good to know

- The server reads its API key from `TOKONOMIX_API_KEY` or `~/.tokonomix/credentials.json`
  (written `0600`). It never logs the key.
- The only fields the client sends outbound on a consensus call are `messages`, an
  `x_council` metadata block, and `max_tokens`, to the configured gateway — no
  hidden fields, no client-side telemetry.
- Personal-data prompts should use EU-hosted councils — see the skill's
  "Data residency" section, and the data-governance note in the README.

## What the server will fetch (`github_refs` SSRF allowlist)

When you ground a call with `context.github_refs`, the gateway fetches those URLs
**server-side** — so what it will and will not reach is a security property worth
stating plainly. Every ref must pass all of the following before a single byte is
read. Any failure means the ref is simply **skipped, not fetched**; if every ref
is skipped the grounding is surfaced back to you as *not applied* (the call
proceeds ungrounded-but-loud, never a hard error) — there is no silent
substitution:

- **`https` only.** `http`, `file`, `gopher` and every other scheme are refused.
- **A strict host allowlist — public GitHub file hosts only:**
  `raw.githubusercontent.com`, `gist.githubusercontent.com`, and `github.com`. No
  other domain is fetched, so the feature cannot be pointed at an arbitrary site.
- **IP-literal hosts are rejected** (a host that parses as an IP can never be an
  allowlisted GitHub host).
- **DNS is resolved and every resolved address is checked;** the fetch is refused
  if any address is private or reserved — loopback, RFC1918 (`10/8`, `172.16/12`,
  `192.168/16`), link-local and the cloud-metadata address `169.254.169.254`,
  IPv6 ULA/link-local, and CGNAT `100.64/10`. This is what stops a public hostname
  from being used to reach an internal service.
- **Redirects are refused** (`redirect: 'error'`) — a redirect could otherwise
  leave the allowlist after the checks passed.
- **Bounded read:** a hard **5 MB** per-ref byte cap and an **8-second** timeout.
- **A private or missing repo is not an error and is not fetched.** A `401`/`403`
  (private) or `404` is treated as a clean skip — the council never sees content
  behind auth you did not provide.

The council **never auto-fetches other URLs on your behalf** — only these
allowlisted `github_refs`, and only when the feature is enabled for your account
(the `context_upload_github_enabled` gate, which is fail-closed: off unless
explicitly turned on). Grounding you have not explicitly attached is never
retrieved. (Implementation: `fetchGithubRef` / `validateGithubRef` /
`isPrivateOrReservedIp`.)
