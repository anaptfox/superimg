# Testing

The repository pins Node.js 26.13.1 in `.node-version` and `.nvmrc`, and
pnpm 12.18.0 in the root `package.json`. From the repository root, install the
workspace and the Chromium revision used by Playwright:

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
```

On Linux, add `--with-deps` to install Chromium's system libraries. The full
gate also runs the packed consumer checks, which require registry access and
FFmpeg. See [packed consumer prerequisites](./codec-consumer-testing.md).

Start with deterministic checks:

```bash
superimg check path/to/media.media.ts
superimg inspect path/to/media.media.ts
```

For collections, `check` validates the complete entry snapshot. Repeat `--entry` to restrict it. Provider failures, timeouts, invalid JSON values, duplicate/path-unsafe ids, nested collections, and interactive collections fail during preflight.

```bash
superimg check episodes --entry introduction
superimg export episodes --entry introduction --for youtube
```

Interactive scene checks are exported only from `@foxworth/superimg/interactive/define`.

Coverage floors live in each package `vitest.config.ts`. Package-wide: stdlib 75% statements / 65% branches, core 50% / 45%. **New product files** (tree primitives, `tree-check`, Chromium preflight) must stay at **90% statements**. Do not raise the package floor to chase old heuristic files (`motion-critique`).

Repository gates:

```bash
just build-render
pnpm verify:examples
pnpm verify:generated-artifacts
pnpm verify:docs
pnpm check
just publish-dry
```

The full and affected gates cap Turbo at 25% of available CPU concurrency.
Cold app builds and native media encoding can still compete with browser
tests on a busy machine. To run only the Turbo phase with two tasks at a time:

```bash
pnpm turbo:prepare &&
pnpm exec turbo run build test typecheck check-types verify lint lint:root --concurrency=2
```

Vitest 5 fork pools use `maxWorkers: 1` when a package needs serial file
scheduling. The obsolete `singleFork` option no longer provides that limit.
Keep file isolation enabled. For a serial suite inside a concurrent context,
use `describe(name, { concurrent: false }, fn)`.

Vitest 5 adds an optional Browser Mode Trace View. Enable it for the browser
export and runtime-conformance suites when replay evidence would help diagnose
a failure; canvas pixels and loaded images are included in the trace:

```bash
SUPERIMG_TRACE_VIEW=1 pnpm --filter @superimg/browser-export exec vitest run --config vitest.browser.config.ts --reporter=html
SUPERIMG_TRACE_VIEW=1 pnpm --filter @superimg/runtime-conformance exec vitest run --config vitest.browser.config.ts --reporter=html
```

The static trace report is written to `.vitest/index.html` in the package.

Trace View collection defaults off. Its replay is diagnostic evidence, with
known limits around adopted stylesheets, external resources, and custom element
code. It does not turn tests that launch Playwright directly into Vitest Browser
Mode tests.

For Node suites, Vitest 5 can persist transformed modules between processes.
Try the opt-in cache on one package at a time, then clear Vitest's caches if a
transform looks stale:

```bash
pnpm --filter @superimg/core exec vitest run --fsModuleCache
pnpm exec vitest --clearCache
```

The filesystem module cache is off by default and does not apply to Browser
Mode. It can reuse stale transforms if a plugin reads configuration or files
that Vitest cannot include in the cache key, so keep it opt-in and disable it
while investigating such a mismatch. Vitest's `doctor` command measures
candidate configurations by running tests repeatedly; use it on a green,
stable package suite when tuning workers or isolation:

```bash
pnpm exec vitest doctor --config packages/superimg-core/vitest.config.ts
```

The runtime-conformance Workerd suite continues to use the Cloudflare Vitest
plugin's `cloudflareTest()` pool and the assembled edge entry. The workspace
uses the Cloudflare Vitest plugin 1.6.1 with Vitest 5.1.0. Request V8 coverage with
`pnpm --filter @superimg/runtime-conformance exec vitest run --config
vitest.workerd.config.ts --coverage --testTimeout=30000`. Coverage
instrumentation can push the longer export cases past their ordinary 5-second
test timeout, so this raises the limit for the diagnostic run. This is separate
from the default conformance gate.
