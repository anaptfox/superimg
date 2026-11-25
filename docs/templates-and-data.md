# Templates and Data

Author media content with `video`, `image`, `svg`, or `ogImage`. Each helper accepts `sample`, `render`, an optional custom `size`, exact-aspect `editions`, and root data `variants`.

```ts
import { image } from "@foxworth/superimg";

export default image<Product>({
  size: { width: 750, height: 1050 },
  sample: { id: "sample", name: "Camera" },
  render(ctx) {
    return `<h1>${ctx.data.name}</h1>`;
  },
});
```

For batch materialization, place the deterministic definition inside `collection({ entries, media, entryId? })`. Providers are zero-argument sync/async functions imported from dedicated server modules. Static readonly arrays are also supported.

```ts
export default collection({
  entries: loadProducts,
  entryId: "slug",
  media: image<Product>({ render: renderProduct }),
});
```

Destinations and custom sizes are requested during export, outside authored data:

```bash
superimg export products --for instagram-square --for 1200x630.png
```
