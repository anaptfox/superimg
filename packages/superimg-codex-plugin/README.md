# @superimg/codex-plugin

Codex CLI plugin for SuperImg. Distributes the canonical SuperImg skill and the `@superimg/mcp` server through OpenAI's [Codex plugin system](https://developers.openai.com/codex/plugins/build).

This package is **not published to npm** — Codex installs it directly from the Git repo via the marketplace at `<repo root>/.agents/plugins/marketplace.json`.

## Layout

```
.
├── package.json
├── scripts/generate-plugin-skill.ts   # SKILL.md ← @superimg/skill (build step)
└── plugin/                             # what Codex actually clones
    ├── .codex-plugin/plugin.json       # plugin manifest
    ├── .mcp.json                        # → npx -y @superimg/mcp
    ├── skills/superimg/                 # GENERATED at build time, gitignored
    │   ├── SKILL.md
    │   ├── references/api.md
    │   └── examples/{hello-world,stats-card}.ts
    └── assets/{icon,logo}.svg
```

## Build

```bash
pnpm --filter @superimg/codex-plugin build
```

Regenerates `plugin/skills/superimg/` from the canonical `@superimg/skill` content. Run this whenever `skills/superimg/` at the repo root changes (the monorepo build does it automatically).

## Install (end users)

```bash
codex marketplace add github.com/anaptfox/superimg
codex plugin install superimg@anaptfox
```

After install, Codex automatically:

- Loads the SuperImg skill (mental model + cheat sheet + references + examples).
- Spawns the SuperImg MCP server on demand, exposing `validate`, `list_videos`, and `info` tools so Codex can introspect the project without shelling out.

## Verify locally

After running the build, you can inspect the plugin tree and validate the manifest manually:

```bash
cat packages/superimg-codex-plugin/plugin/.codex-plugin/plugin.json
ls packages/superimg-codex-plugin/plugin/skills/superimg
```

## Updating

Bump `plugin/.codex-plugin/plugin.json#version` and rebuild. Codex caches plugins by version at `~/.codex/plugins/cache/anaptfox/superimg/<version>/`, so version bumps are how end users get refreshed skill content.

## Source-of-truth

- Skill body, references, examples → `<repo root>/skills/superimg/` (canonical)
- → `@superimg/skill` package (build-time-embedded TS strings)
- → this plugin's `plugin/skills/superimg/` (regenerated)
- → Codex marketplace cache after `marketplace add`
