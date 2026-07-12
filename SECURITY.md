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
