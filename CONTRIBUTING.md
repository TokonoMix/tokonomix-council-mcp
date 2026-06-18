# Contributing to tokonomix-council-mcp

Thanks for your interest! This repo is the open MCP server + the
`tokonomix-consensus` skill. The hosted gateway it talks to is a separate,
closed service.

## Ways to help

- **Bug reports** — open an issue with your client (Claude Code / Cursor / Cline / …),
  the version (`npm view tokonomix-council-mcp version`), and steps to reproduce.
- **Compatibility** — tested a client we don't list? Tell us what worked.
- **Docs** — the skill (`skill/tokonomix-consensus/SKILL.md`) is the agent-facing
  contract; clarity fixes are very welcome.

## Development

```bash
npm install
npm run build        # tsc -> dist/
npm run dev          # tsx src/index.ts (live)
```

You need a Tokonomix account to exercise the live tools — run `tokonomix_onboard`
from any MCP client for a free-tier key, or set `TOKONOMIX_API_KEY`.

## Pull requests

- Keep changes surgical and focused; one concern per PR.
- Match the existing TypeScript style; `npm run build` must pass with no errors.
- Don't commit secrets, `.env*`, or `~/.tokonomix/` artifacts.
- Update `skill/tokonomix-consensus/CHANGELOG.md` for user-visible changes (it
  drives the in-conversation update notice).

## Publishing

This repo is **generated** from an upstream canonical copy via a one-way mirror — do not
hand-edit it expecting changes to stick, as the next sync overwrites the tree. Land changes
upstream; maintainers publish with a dry-runnable mirror script (diff vs this remote first,
then an explicit, supervised push), with `npm publish` as a separate, supervised channel.
Outside contributions are welcomed as PRs and folded in upstream.

## Security

Please report vulnerabilities privately — see [SECURITY.md](./SECURITY.md).

By contributing you agree your contributions are licensed under the repo's
[MIT license](./LICENSE).
