---
description: SuperImg Core Development Rules
globs: 
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
  - "**/*.md"
---

# SuperImg Core Development Rules

When developing within the `superimg` repository, follow these guidelines to ensure consistency with the existing architecture and workflows.

## Essential Context Links

Please always refer to these files for detailed information before making structural changes:
- @/CLAUDE.md: Top-level commands and architecture overview
- @/docs/api.md: Comprehensive API references and types
- @/docs/project-config.md: Details on `ProjectConfig` and `TemplateConfig` schemas
- @/docs/templates-and-data.md: Details on defining scenes, handling data, and using CSS utilities

## Tooling and Commands
- **Use `just`:** This project uses [Just](https://github.com/casey/just) for task automation. Always use `just <recipe>` instead of raw `pnpm` or `npm` commands where defined.
- Refer to @/CLAUDE.md for a complete reference of the available Just recipes (e.g., `just build`, `just dev`, `just test`).

## Code Structure (from @/CLAUDE.md)
- Workspaces: Ensure you are modifying the correct workspaces inside `packages/` or `apps/`.
- Media programs live under `examples/` and use the `*.media.ts` suffix.

## Export Commands
Use destination-first export through the built CLI:
```bash
node ./packages/superimg-cli/dist/cli.js export <path.media.ts> --for youtube
```
