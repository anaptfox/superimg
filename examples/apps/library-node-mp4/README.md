# Node MP4 render

```ts
import { render } from "@foxworth/superimg/runtime";
import clip from "./clip.media";
await writeFile("out/clip.mp4", await (await render(clip, { as: "mp4" })).bytes());
```
