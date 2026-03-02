# SuperImg × Next.js AI SDK — Video Generation Example

Type a topic. Get a video.

This example demonstrates the **AI agent → video output** pattern:

1. User enters a topic (e.g. "The rise of AI in 2025")
2. The Next.js API route calls `generateObject` from the [Vercel AI SDK](https://sdk.vercel.ai/) to produce structured JSON: a headline, 3 stats, a summary, and an accent color
3. The SuperImg `<Player>` renders every frame live in the browser at 60fps
4. The user can export the result to MP4 with one click

## Why this matters

The SuperImg template is a **pure TypeScript function that returns HTML**. That makes it the simplest possible target for AI to write data for — no special training, no video tooling expertise required.

```
AI generates JSON → SuperImg renders video → User downloads MP4
```

## Setup

This example runs fully locally — no API keys required.

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

Ollama must be running locally (`ollama serve`) when you start the dev server. If Ollama is on a different host or port, set `OLLAMA_BASE_URL` in `.env.local`.

Open [http://localhost:3000](http://localhost:3000).

## File Structure

```
app/
  layout.tsx              Root layout
  page.tsx                Main UI: prompt input + Player + export
  api/generate/route.ts   AI SDK generateObject endpoint
lib/
  template.ts             SuperImg defineScene (the report card)
```

## Key Code

**`app/api/generate/route.ts`** — The AI endpoint uses `generateText` + `Output.object()` (AI SDK v6) with a Zod schema to return structured video data (not free-form text):

```ts
const { output } = await generateText({
  model: openai("gpt-4o-mini"),
  output: Output.object({ schema: VideoDataSchema }),
  prompt: `Generate video data for: "${topic}"`,
})
```

**`lib/template.ts`** — The template is fixed; only the data changes:

```ts
export const reportCardTemplate = defineScene<VideoData>({
  render({ sceneTimeSeconds: t, data, std, width, height }) {
    // Animate headline, stats, summary based on `t` and `data`
    return `<div>...</div>`
  },
})
```

**`app/page.tsx`** — Pass AI-generated data straight to the player:

```tsx
<Player template={reportCardTemplate} data={aiGeneratedData} />
```

## Extending This

- Swap `gpt-4o-mini` for any AI SDK provider (Anthropic, Google, etc.)
- Change the template to match your brand
- Add `--data products.json` to the CLI to batch-render 1,000 videos
- Call `session.exportMp4()` programmatically from a server action
