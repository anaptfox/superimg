# SuperImg × Next.js AI SDK — Video Generation Example

Type a topic. Get a video timeline.

This example demonstrates the **AI agent → video output** pattern:

1. User enters a topic (e.g. "The history of JavaScript")
2. The Next.js API route calls `generateText` + `Output.object()` from the [Vercel AI SDK](https://sdk.vercel.ai/) to produce structured JSON: a title, 5–8 chronological events, and an accent color
3. The SuperImg `<Player>` renders every frame live in the browser at 30fps
4. The user can export the result to MP4 with one click

## Why this matters

The SuperImg template is a **pure TypeScript function that returns HTML**. That makes it the simplest possible target for AI to write data for — no special training, no video tooling expertise required.

```
AI generates JSON → SuperImg renders video → User downloads MP4
```

## Setup

This example runs fully locally with [Ollama](https://ollama.com) — no API keys required.

```bash
# 1. Pull the model (one-time setup)
ollama pull llama3.2

# 2. Install and run (from the monorepo root)
just install
just example apps/nextjs-ai-video
```

Or run directly from this directory:

```bash
pnpm install
pnpm dev
```

Ollama must be running locally (`ollama serve`) when you start the dev server. To use a different host/port or model, set `OLLAMA_BASE_URL` or `OLLAMA_MODEL` in `.env.local`.

Open [http://localhost:3000](http://localhost:3000).

## File Structure

```
app/
  layout.tsx              Root layout
  page.tsx                Main UI: prompt input + Player + export
  api/generate/route.ts   AI SDK generateText + Output.object endpoint
lib/
  template.ts             SuperImg define() template + duration helper
```

## Key Code

**`app/api/generate/route.ts`** — The AI endpoint uses `generateText` + `Output.object()` (AI SDK v7) with a Zod schema so the model returns structured timeline data instead of free-form text:

```ts
import { generateText, Output } from "ai";
import { ollama } from "ai-sdk-ollama";

const { output } = await generateText({
  model: ollama(process.env.OLLAMA_MODEL ?? "llama3.2"),
  output: Output.object({ schema: TimelineSchema }),
  prompt: `Create an accurate, chronological timeline about: "${topic}"`,
});
```

**`lib/template.ts`** — The template is fixed; only the data changes. Runtime is derived from the event count via `calculateTimelineDuration()`, the single source of truth shared by both the `<Player>` and the MP4 exporter:

```ts
export const timelineTemplate = define<TimelineData>({
  config: { fps: 30, width: 1920, height: 1080, /* ... */ },
  render({ timeline, data, std, width, height }) {
    // Animate title, events, and outro based on `timeline.seconds` and `data`
    return `<div>...</div>`;
  },
});
```

**`app/page.tsx`** — Pass AI-generated data straight to the player, and export with the `usePlaygroundExport` hook:

```tsx
import { Player } from "superimg/react";
import { usePlaygroundExport } from "superimg/react/export";

const { exportMp4, download } = usePlaygroundExport({ template: timelineTemplate, duration });

<Player template={timelineTemplate} data={videoData} duration={duration} />
```

## Extending This

- Swap `ollama("llama3.2")` for any AI SDK provider (`openai`, `anthropic`, `google`, …)
- Change the template in `lib/template.ts` to match your brand
- Adjust `TIMELINE_TIMING` to retune pacing — duration recomputes automatically
- Render headlessly at scale with the SuperImg CLI (`superimg render --all`)
