# defineScene Example

A minimal template using `defineScene` — the standard pattern for SuperImg templates.

## Quick Start

```bash
pnpm dev        # Browser preview with hot reload
pnpm render     # Render to output.mp4
```

## Template Structure

Templates use `defineScene` with a single default export:

```ts
import { defineScene } from "superimg";

export default defineScene({
  defaults: { ... },
  config: { ... },
  render(ctx) { ... },
});
```

Use `defineScene` for TypeScript type inference on `ctx.data` from your defaults.
