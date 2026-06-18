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

## Good to know

- The server reads its API key from `TOKONOMIX_API_KEY` or `~/.tokonomix/credentials.json`
  (written `0600`). It never logs the key.
- The skill self-update fetches public, key-less documentation over HTTPS and
  treats the gateway response as untrusted input (control characters stripped,
  length-capped) before displaying it.
- Personal-data prompts should use EU-hosted councils — see the skill's
  "Data residency" section.
