# git-history-video

Generate git-history videos from your repo data. One command, three templates.

```
  Extracting git history...
  ✓ 8 milestones from "superimg"
  Rendering contributors (horizontal, 1920×1080)...
  [████████████████████████████████] 100%
  ✓ Saved to .../examples/apps/git-history-video/output/contributors.mp4
```

## How it works

1. Reads your git log (commits + numstat)
2. Builds analytics payloads (timeline milestones, contributor stats, commit-race data)
3. Renders a 12-second video using the selected SuperImg template
4. Writes the MP4 to disk

No AI, no API keys, no cloud. Runs entirely locally via Playwright headless rendering.

## Usage

Run from the monorepo root with `pnpm`:

```bash
pnpm --filter git-history-video dev
```

### Options

```
-o, --output <file>    Output file (default: output/<template>.mp4)
-n, --count <n>        Number of commits, 3-12 (default: 8)
-f, --format <fmt>     horizontal | vertical | square (default: horizontal)
-t, --template <name>  timeline | contributors | race (default: contributors)
-b, --branch <name>    Git branch (default: current)
    --since <date>     Only commits after this date (e.g. 2024-01-01)
-h, --help             Show help
```

### Examples

```bash
# Default: contributors template to output/contributors.mp4
pnpm --filter git-history-video dev

# Timeline template
pnpm --filter git-history-video dev -- --template timeline

# Commit race template in square format
pnpm --filter git-history-video dev -- --template race --format square

# Vertical contributors video with custom name
pnpm --filter git-history-video dev -- --template contributors -f vertical -o output/team-story.mp4

# Only commits since 2024
pnpm --filter git-history-video dev -- --since 2024-01-01
```

## Prerequisites

SuperImg uses Playwright for headless rendering. Install it once:

```bash
npx playwright install chromium
```

## File Structure

```
src/
  cli.ts                  Entry point — arg parsing, orchestration, progress bar
  git.ts                  git log → analytics payloads
  templates/
    timeline.ts           Timeline milestones
    contributors.ts       Contributor leaderboard
    race.ts               Cumulative commit race
```

## Why this example matters

This demonstrates the **CLI rendering pipeline** — the other half of SuperImg:

- The [nextjs-ai-video](../nextjs-ai-video/) example shows the **React/browser** path (AI generates data → Player renders live)
- This example shows the **Node.js/headless** path (git generates data → Playwright renders to MP4)

**When to use these templates:**
- Use these generic presets when you need fast, clean, reusable project-activity videos with minimal design decisions.
- Build custom templates with SuperImg directly when you need brand identity, bespoke storytelling, custom scene systems, or unique motion language.
