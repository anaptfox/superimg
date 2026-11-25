# SuperImg docs site

Next.js app for **user-facing** documentation, landing, playground, and showcase.

## Docs content rules

1. **Story:** Write a media program once — play it live, export it anywhere. Lead with that job (Author default), not package architecture.
2. **Doors:** docs nav is **Author · Embed · Extend**. Extend never competes on the hero.
3. **Canonical imports:** `superimg`, `@foxworth/superimg/player`, `@foxworth/superimg/runtime`, `@foxworth/superimg-interactions` (the `@foxworth/superimg-cli` package), and the role-specific `@foxworth/superimg/react/*` paths.
4. **Nav:** every slug in `lib/docs-nav.ts` has a matching `content/docs/<slug>.mdx`.
5. **Depth:** keep MDX scannable; link to repo `docs/*.md` for full APIs and architecture.
6. **Landing / intro** copy must match the root README: Author first, Embed second, no “two products” framing.

## Develop

```bash
# from monorepo root
pnpm --filter docs dev    # http://localhost:3001
```

`predev` runs example generation for the playground.

## Layout

| Path | Role |
|------|------|
| `content/docs/*.mdx` | User-facing docs pages |
| `lib/docs-nav.ts` | Sidebar IA (Author · Embed · Extend) |
| `components/landing/*` | Marketing home |
| `content/blog/*` | Blog |
| Repo `docs/*.md` | Deep / contributor guides (not auto-synced) |
