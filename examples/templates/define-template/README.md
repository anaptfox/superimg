# defineTemplate Example

A minimal template using `defineTemplate` — the recommended pattern for TypeScript templates.

## Quick Start

```bash
pnpm dev        # Browser preview with hot reload
pnpm render     # Render to output.mp4
```

## What's Different from Hello World?

The `hello-world` example uses **named exports**:

```js
export const defaults = { ... };
export const config = { ... };
export function render(ctx) { ... }
```

This example uses **`defineTemplate`** — a single default export that bundles everything together:

```ts
import { defineTemplate } from "superimg";

export default defineTemplate({
  defaults: { ... },
  config: { ... },
  render(ctx) { ... },
});
```

Both patterns work with the CLI (`dev`, `render`, `info`). Use `defineTemplate` when you want TypeScript type inference for `ctx.data` based on your defaults.
