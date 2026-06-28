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

Templates are `*.media.ts` files discovered anywhere in the project. Template kind (video, image, gif, svg) is determined by `define()` config — not the filename.

**Examples location**: `examples/<category>/<name>/<name>.media.(ts|js)`

**CLI shorthand** (from monorepo root):
```bash
CLI="node ./packages/superimg/dist/cli.js"
```

| Action | Command |
|--------|---------|
| List all templates | `$CLI list` |
| Dev/preview | `$CLI dev <path>` |
| Render to MP4 | `$CLI render <path>` |
| Render every template | `$CLI render --all -y` |

**Render examples**:
```bash
# Render a template
node ./packages/superimg/dist/cli.js render examples/basics/hello-world/hello-world.media.js

# Render compose demo (multi-scene)
node ./packages/superimg/dist/cli.js render examples/basics/compose-demo/compose-demo.media.ts

# Render every video in the project. Multi-output templates (those declaring
# config.outputs) automatically render all presets (e.g. youtube + reel);
# single-output templates render once at their default config.
node ./packages/superimg/dist/cli.js render --all -y
```

Output: `output/<name>.mp4`

**Requires**: Playwright browsers installed (`just setup` or `npx superimg setup`)
