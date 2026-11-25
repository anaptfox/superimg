# Next.js Open Graph route

```ts
import { renderResponse } from "@foxworth/superimg/runtime";
import card from "../media/card.media";
export const GET = (req: Request) => renderResponse(card, { as: "png", data: { title: new URL(req.url).searchParams.get("title") ?? "SuperImg" } });
```
