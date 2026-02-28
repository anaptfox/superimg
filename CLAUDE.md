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
