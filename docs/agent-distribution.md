# Agent distribution

How SuperImg's skills reach AI coding agents: one canonical source, generated
adapters per agent, a drift check in CI. Modeled on `JuliusBrussee/caveman`
(multi-agent reach) and `remotion-dev/skills` (skill structure for a media
framework).

## Install matrix

| Agent | Install | Mechanism |
|---|---|---|
| Claude Code | `claude plugin marketplace add anaptfox/superimg && claude plugin install superimg@superimg` | `.claude-plugin/` at repo root; skills/agents/commands auto-discovered |
| Grok CLI (Build) | `grok plugin install superimg --trust` | `.grok-plugin/marketplace.json` → `packages/superimg-agent-plugins/grok` |
| Grok Bot | Settings → Plugins, or symlink `packages/superimg-agent-plugins/grok-bot` to `~/.cursor/plugins/local/superimg` | `.cursor-plugin/marketplace.json` → arrangements-only plugin |
| Codex CLI (native plugin) | marketplace `.agents/plugins/marketplace.json` | → `packages/superimg-agent-plugins/codex` |
| Codex / Cursor / Windsurf / Cline / Amp / Goose / Warp / … | `npx skills add anaptfox/superimg -a <agent>` | root `skills/<name>/SKILL.md` convention (also what skills.sh indexes) |

## Canonical sources (hand-edited)

```
skills/<name>/            SKILL.md + references/ + examples/  (10 skills)
agents/video-designer.md  subagent definition
commands/*.md             slash commands
packages/superimg-agent-plugins/assets/  icon.svg, logo.svg
```

Frontmatter contract per SKILL.md: `name`, `description`, `version`
(stamped — see below).

## Generated artifacts (never hand-edit)

`pnpm --filter @superimg/agent-plugins build` (script:
`packages/superimg-agent-plugins/scripts/generate.ts`) emits:

| Artifact | Purpose |
|---|---|
| `version:` in every `skills/*/SKILL.md` | locked to the `superimg` package version — answers skill↔package drift once skills live on user machines |
| `skills/<name>/agents/openai.yaml` + `assets/icon.svg` | Codex/OpenAI surface metadata (display name, brand color `#667eea`, default prompt) |
| `skills/superimg-pipeline/<sibling>/REFERENCE.md` + support files | embedded router copies: installing the pipeline skill alone carries the whole knowledge tree; `REFERENCE.md` (not `SKILL.md`) so scanners don't double-register |
| `commands/*.toml` | Codex prompt variants of each command |
| `packages/superimg-agent-plugins/grok/` | full Grok **Build** plugin tree (skills, agents, commands, assets, plugin.json) |
| `packages/superimg-agent-plugins/grok-bot/` | Grok **Bot** / Cursor plugin: `superimg-arrangements` only, plus `/arrange` |
| `packages/superimg-agent-plugins/codex/` | full Codex plugin tree (`.codex-plugin/plugin.json` with interface metadata, skills, command TOMLs, assets) |

All generated output is committed — marketplace installs pull from git.

## Two Grok plugins

Grok **Build** (`grok/`): the coding-agent pack. Full SuperImg lifecycle.

Grok **Bot** (`grok-bot/`): teammates with a cloud computer. Skills are
`superimg-arrangements` only, plus `/arrange`. The job is a library of
perceptual contracts (`arrange.pointWithContext`,
`arrange.registeredComparison`, `arrange.alignedIntervals`) — not
`compare` / `overlay` / `compose`, and not the public example catalog.

Bot is a **trusted native dispatcher**: same user, SuperImg CLI on that
computer. The plugin is design knowledge. It does not bind, grant, or
dispatch. Install with `npm i @foxworth/superimg` and `npm i -D @foxworth/superimg-cli`, then
publish with `npx superimg export` (a media file) or `npx superimg cortex`
(bundle JSON; value-first write, not `media.export`). Exact source edits go
through `npx superimg edit` (Edit Program). One-off CLI use is
`npx @foxworth/superimg-cli <cmd>`. Do not treat plugin install or file
possession as authority.

The local CLI can register a temporary Boundary Reach while a media command
owns its runtime. That surface exposes direct describe, check, inspect,
thumbnail and `media.arrange.still`; it is not a persistent crew host and does
not install request-mode export, compile or snapshot execution. Inline stills
return PNG bytes, while `superimg export ... --for ...` publishes a local
bundle with a receipt. Both use shared arrangement preparation and authored
aspect selection. Inline requests must carry `asset:<id>` bytes for specimen
images; file-relative resources require the native file host. `at` on the
inline interaction is seconds, and omission uses the pattern answer poster.
Its default canvas remains 1080×1080: a wide root therefore needs a square
edition, or explicit same-aspect width and height. Unauthored aspect reflow is
refused rather than silently changing the composition. This changes the
handler's acceptance behavior without changing its wire schema; a matching
Program digest does not establish old/new behavioral equivalence.

Local Bot install (until Cursor marketplace listing exists):

```bash
ln -s "$(pwd)/packages/superimg-agent-plugins/grok-bot" ~/.cursor/plugins/local/superimg
```

Then Grok Bot → Settings → Plugins → Yours. The Bot computer still needs
`npm i @foxworth/superimg`, `npm i -D @foxworth/superimg-cli`, and Chromium to rasterize;
SVG/image programs that only use layout nodes can
be authored without binary assets.

Public Cursor Marketplace submit is a later review step. Do not claim the Bot
plugin is publicly installable until that listing exists.

## Anti-drift

`pnpm --filter @superimg/agent-plugins verify` regenerates in memory and fails
(listing changed/missing/stale files) if the committed output differs. It runs
as the package's `verify` script, so `just check` / CI catch drift
automatically. Editing a skill without rebuilding fails the gate.

Validate the Claude plugin after manifest changes: `claude plugin validate .`

## Release flow

`just bump` changes package versions → the next `agent-plugins` build restamps
every SKILL.md → commit the regenerated tree with the bump. No npm publishing
is involved anywhere in agent distribution; it is all git/marketplace-based.

## Not built yet (deliberate)

- **Scaffolding funnel** — offer skill install during `npx superimg setup` /
  project init (Remotion's biggest growth lever via `bun create video`).
- **`superimg agents install`** — CLI subcommand that detects installed agents
  and runs each native install path (port caveman's `PROVIDERS` matrix from
  `cli/install.js`: `command:` / `macapp:` / `vscode-ext:` / `dir:` probes).
- **Skills mirror repo** — a synced `anaptfox/superimg-skills` if monorepo
  clone weight ever hurts `npx skills add` installs (Remotion pattern).
- **Gemini extension** — `gemini-extension.json` + `GEMINI.md` if demand shows.
- **Cursor Marketplace public listing** — Grok Bot plugin is packaged; public
  review/submit is not done.
