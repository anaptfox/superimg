# Browser WebP download

```ts
import { render } from "@foxworth/superimg/runtime";
import card from "./card.media";
const url = URL.createObjectURL(await (await render(card, { as: "webp" })).blob());
```
