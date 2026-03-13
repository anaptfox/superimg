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
- Templates: Video examples are located in `examples/templates/<name>/<name>.video.ts`.

## Render Commands
Never run `pnpm render`. The CLI should be accessed via the node output script:
```bash
node ./apps/superimg/dist/cli.js render <path>
```
