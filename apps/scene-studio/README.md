# SuperImg Scene Studio

Interactive multi-artwork exhibit for SuperImg semantic scenes. Ships **The Weight of a Choice** (Living Canvas) and scaffolded studies under an explicit registry.

The app imports only public SuperImg APIs:

- `defineInteractive()` owns the singular experience, guide, and semantic scene
- `centeredCamera`, `focusOn`, and `captionStates` come from `@foxworth/superimg/interactive/define`
- `<InteractivePlayer>` accepts live host data and exposes explicit scene controls
- style profiles are local renderers over the interactive scene snapshot
- focused tests validate guide identity, lowering, and surface CSS parity

```bash
pnpm --filter @superimg/scene-studio dev
pnpm --filter @superimg/scene-studio test
pnpm --filter @superimg/scene-studio test:browser
pnpm --filter @superimg/scene-studio build

# Scaffold a second artwork (then register in src/artworks/index.ts)
just new-artwork my-study
```

To qualify the assembled player against the Studio production artifact, rebuild
the render packages before the app, then run the dedicated preview check. It
serves `dist/` with Vite preview; it does not exercise the development server.

```bash
just build-render
pnpm --filter @superimg/scene-studio build
(cd apps/scene-studio && node ../../node_modules/vitest/vitest.mjs run --config vitest.production-browser.config.ts --reporter=verbose)
```

**URL params:** `?act=recognition&surface=blueprint&edition=portrait&debug=1&artwork=living-canvas`
