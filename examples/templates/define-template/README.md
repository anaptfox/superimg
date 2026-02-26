# defineTemplate Example

A minimal template using `defineTemplate` — the standard pattern for SuperImg templates.

## Quick Start

```bash
pnpm dev        # Browser preview with hot reload
pnpm render     # Render to output.mp4
```

## Template Structure

Templates use `defineTemplate` with a single default export:

```ts
import { defineTemplate } from "superimg";

export default defineTemplate({
  defaults: { ... },
  config: { ... },
  render(ctx) { ... },
});
```

Use `defineTemplate` for TypeScript type inference on `ctx.data` from your defaults.
