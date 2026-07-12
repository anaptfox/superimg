# SuperImg

Programmatic video generation framework. HTML/CSS templates → MP4.

## Skills & agents (video / design)

Use these when building or critiquing SuperImg media — not only the framework skill.

| Name | Kind | Path | When to use |
|------|------|------|-------------|
| **superimg** | Skill | `skills/superimg/SKILL.md` (also managed block in `AGENTS.md`; Claude: `.claude/skills/superimg` via install) | API mechanics: `define()`, director, layers, stdlib, CLI, **inspect** debug loop |
| **animator** | Skill | `skills/animator/SKILL.md` (symlink: `.claude/skills/animator` → repo skill) | Motion craft: timing tables, easing, stagger, framing, SVG techniques, critique checklist. Load `skills/animator/references/` (`motion-craft.md`, `scene-framing.md`, `svg-techniques.md`) when going deep |
| **video-designer** | Subagent | Claude: `.claude/agents/video-designer.md` · Codex: `.codex/agents/video-designer.toml` | Heavy creative work: scenes, diagrams, line art, palettes, motion graphics, explainer visuals. Reads superimg + animator skills first, then designs/implements |

**Routing:**
- Framework / CLI / template bugs → **superimg** skill + `inspect`
- “Motion feels off” / pacing / easing / holds → load **animator** skill
- New scene design, visual redesign, pedagogical viz, complex SVG craft → spawn **video-designer** (it must load superimg + animator before coding)

Do not invent CSS keyframes/timers for video templates — motion is pure `render(ctx)` + director/stdlib (see skills).

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

## Git

Never add a Claude/Anthropic co-author trailer to commit messages in this repo.

## Video Project Structure

Templates are `*.media.ts` files discovered anywhere in the project. Template kind (video, image, gif, svg) is determined by `define()` config — not the filename.

**Examples location**: `examples/<category>/<name>/<name>.media.(ts|js)`

**CLI shorthand** (from monorepo root):
```bash
CLI="node ./packages/superimg-cli/dist/cli.js"
```

| Action | Command |
|--------|---------|
| List all templates | `$CLI list` |
| Dev/preview | `$CLI dev <path>` |
| Render to MP4 | `$CLI render <path>` |
| Inspect (debug) | `$CLI inspect <path> --pretty` |
| Render every template | `$CLI render --all -y` |

**Render examples**:
```bash
# Render a template
node ./packages/superimg-cli/dist/cli.js render examples/basics/hello-world/hello-world.media.js

# Render compose demo (multi-scene)
node ./packages/superimg-cli/dist/cli.js render examples/basics/compose-demo/compose-demo.media.ts

# Render every video in the project. Multi-output templates (those declaring
# config.outputs) automatically render all presets (e.g. youtube + reel);
# single-output templates render once at their default config.
node ./packages/superimg-cli/dist/cli.js render --all -y
```

Output: `output/<name>.mp4`

**Requires**: Playwright browsers installed (`just setup` or `npx superimg setup`)

## Debug (templates)

**Prefer `inspect` first** — do not shell many single-frame renders to learn timing.

```bash
$CLI inspect path/to/foo.media.ts --pretty
$CLI inspect path/to/foo.media.ts --diff 0.35,0.85
$CLI inspect path/to/foo.media.ts --at 0.5,0.9 --png   # only if HTML is ambiguous
$CLI render path/to/foo.media.ts -y                     # final polish
```

| Tool | For |
|------|-----|
| `inspect` | Runtime config, director phases, multi-progress text/colors, `--diff` (JSON, no browser by default) |
| `info` | Config + phase summary |
| `validate` | NaN / throws / empty frames |
| `doctor` / `setup` | Environment / Chromium |
| `render --format html\|png --frame N` | One exact still |

Full portable debug guidance lives in the superimg skill (`skills/superimg/SKILL.md` → `superimg skill update`). See also `docs/testing.md`.

After structure looks right, critique motion with the **animator** skill checklist; for major visual redesigns use **video-designer**.

**Footguns:** Prefer **percent** director phases (sum 100%) for still/HTML single-frame paths. Const-bound `duration`/`width`/etc. are AST-folded; dynamic `resolve()` still needs runtime inspect.
