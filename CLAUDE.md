# SuperImg

Programmatic video generation framework. HTML/CSS templates → MP4.

## Commands

This project uses [Just](https://github.com/casey/just) for task automation. **Always use `just <recipe>` instead of raw pnpm/npm commands.**

| Task | Command |
|---|---|
| Setup (first time) | `just setup` |
| Install deps | `just install` |
| Dev (all packages) | `just dev` |
| Docs site | `just docs` |
| Run example | `just example <name>` |
| Build package | `just build-pkg <name>` |
| Dev package | `just dev-pkg <name>` |
| Test package | `just test-pkg <name>` |
| Build all | `just build` |
| Rebuild (clean + build) | `just rebuild` |
| Run tests | `just test` |
| Lint | `just lint` |
| Type-check | `just typecheck` |
| Clean | `just clean` |
| Full check | `just check` |
| Version bump | `just bump` |
| Publish | `just publish` |
| Release workflow | `just release` |

Run `just` or `just --list` to see all available recipes.

## Video Project Structure

Videos are `*.video.ts` files discovered anywhere in the project. No special config needed.

**Examples location**: `examples/templates/<name>/<name>.video.ts`

**CLI shorthand** (from monorepo root):
```bash
CLI="node ./apps/superimg/dist/cli.js"
```

| Action | Command |
|--------|---------|
| List all videos | `$CLI list` |
| Dev/preview | `$CLI dev <path>` |
| Render to MP4 | `$CLI render <path>` |

**Render examples**:
```bash
# Render a template
node ./apps/superimg/dist/cli.js render examples/templates/hello-world/hello-world.video.ts

# Render compose demo (multi-scene)
node ./apps/superimg/dist/cli.js render examples/templates/compose-demo/compose-demo.video.ts
```

Output: `output/<name>.mp4`

**Requires**: Playwright browsers installed (`just setup` or `npx playwright install chromium`)
