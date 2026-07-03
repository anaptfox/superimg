# @superimg/browser-bundler

Self-contained ESM artifact for in-browser SuperImg template compilation.

- Inlines `@rolldown/browser` (no separate WASM fetch)
- One file, one hash — verify via `superimg/dist/platform-manifest.json` → `compilerStandalone`

```ts
import { initBundler, bundleTemplateBrowser } from "@superimg/browser-bundler";

await initBundler();
const bundle = await bundleTemplateBrowser(templateSource);
```