# @superimg/core

Internal deterministic compiler and planning primitives for SuperImg.

The package owns source analysis, browser-safe media projection, schema-0 Media IR, destination resolution, and the entry × variant × edition × rendition planner. Public authoring imports from `superimg`; value consumers use `@foxworth/superimg/runtime`, while Node project hosts compose `@foxworth/superimg-interactions` from the `@foxworth/superimg-cli` package.

```ts
import { analyzeMediaSource } from "@superimg/core/source-analysis";
import { planMediaExport } from "@superimg/core/export";
```

Collection provider code and raw entry data are outside browser artifacts and Media IR. IR coordinates use `sourceId`, optional `entryId`, `variantId`, and `editionId`.
