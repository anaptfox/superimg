# `@superimg/next`

Embed a SuperImg media program in a Next.js App Router app — Server Components for payload/poster, Client Components for the Player island.

Builds on **`@superimg/adapters`** for serializable payloads and posters.

**Private / experimental** — not published to npm yet.

## Install (workspace)

```json
{
  "dependencies": {
    "@superimg/next": "workspace:*",
    "@foxworth/superimg": "workspace:*"
  }
}
```

## Mental model

| Entry | Use in | Purpose |
|-------|--------|---------|
| `@superimg/next/server` | Server Components | Payload and poster HTML |
| `@superimg/next/client` | `"use client"` modules only | `Player`, `MediaPlayerIsland` |

Never pass `define()` / `video()` templates across the RSC boundary as props. Import the media program in the client island file.

## Quick start

Author the media program once, then embed it:

```tsx
// lib/template.ts — media program (imported only on the client)
import { video, Frame, Text } from "@foxworth/superimg";

export const timelineTemplate = video({
  duration: "5s",
  sample: { title: "Hello" },
  render(ctx) {
    return Frame(
      { width: "fill", height: "fill" },
      Text({ variant: "display" }, ctx.data.title),
    );
  },
});
```

```tsx
// app/page.tsx — Server Component
import { createServerPayload, posterHtml, toClientProps } from "@superimg/next/server";
import { TimelineClient } from "./components/TimelineClient";
import { sampleIr } from "@/lib/media-ir";

export default function Page() {
  const payload = createServerPayload(sampleIr, {
    data: { title: "Hello" },
  });
  return (
    <main>
      <div dangerouslySetInnerHTML={{ __html: posterHtml(payload) }} />
      <TimelineClient payload={toClientProps(payload)} />
    </main>
  );
}
```

```tsx
// app/components/TimelineClient.tsx
"use client";
import { MediaPlayerIsland } from "@superimg/next/client";
import { timelineTemplate } from "@/lib/template";

export function TimelineClient({ payload }) {
  return <MediaPlayerIsland payload={payload} media={timelineTemplate} />;
}
```

`sampleIr` / Media IR is the extend detail for serializable server payloads. Day-to-day Author work stays in the `.media.ts` / template module.

## Layering

```
Your Next app
  → @superimg/next          App Router helpers (RSC payload + Player island)
  → @superimg/adapters      portable core (payload, poster, vite)
  → superimg / @superimg/*  runtime contracts
```

## Forbidden on the client

See `NEXT_CLIENT_FORBIDDEN` for the CLI, Playwright, and other server-only packages.
