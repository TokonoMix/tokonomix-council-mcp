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

### Release checklist (maintainers)

The working skill draft was accidentally published in 1.7.1/1.7.6/1.7.7 (deprecated /
unpublished). To keep that from recurring, run through this before every publish:

1. `npm run build` — compiles cleanly (no `error TS`).
2. `npm test` — full suite green.
3. `npm run check:pack` — inspect the file list it prints and confirm **OK**; it fails
   the publish if a `*.draft.md`, `*.test.*`, `src/`, `.env*`, or key-material file is in
   the tarball. `prepublishOnly` runs build + test + this check automatically, so a bad
   `npm publish` aborts on its own — but eyeball the printed list anyway.
4. Bump the version and update both changelogs (`skill/tokonomix-consensus/CHANGELOG.md`
   drives the in-conversation update notice).
5. `npm publish --dry-run` once more if in doubt, then publish, then sync the public mirror
   in the same flow.

## Security

Please report vulnerabilities privately — see [SECURITY.md](./SECURITY.md).

By contributing you agree your contributions are licensed under the repo's
[MIT license](./LICENSE).
