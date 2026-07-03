# SuperImg × Docusaurus

Embed live SuperImg `<Player>` previews **inside MDX docs** as inline explainers — not as a homepage hero.

- **`/docs/explainer`** — `DocExplainer` blocks (prose + compact hover-to-play loop)
- **`/docs/player`** — `BrowserOnly` wrapper + Webpack WASM setup
- **Homepage** — text-only landing; links into the docs

## Run

```bash
# From monorepo root
just install
just example apps/docusaurus-player
```

Or from this directory:

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3005/docs/explainer](http://localhost:3005/docs/explainer).

## Integration checklist

1. Add `superimg` dependency (`workspace:*` in this monorepo)
2. Wrap `<Player>` in `@docusaurus/BrowserOnly` for SSR safety
3. Enable `experiments.asyncWebAssembly` in a small Webpack plugin (see `docusaurus.config.ts`)
4. Use `DocExplainer` (or similar) to keep previews inline with prose — avoid full-width hero players in reference docs

## SuperImg import tiers

| Need | Import |
|------|--------|
| Docs preview | `superimg/react` |
| Client MP4 export | `superimg/react/export` |
| Template compile in browser | `superimg/react/compile` |

This example uses preview only.