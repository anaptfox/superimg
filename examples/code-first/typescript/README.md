# Server-Side Rendering Example (TypeScript Template)

This example demonstrates how to use SuperImg as a library for server-side video rendering with a **TypeScript template**.

**Note**: Both the renderer code (`render.ts`) and template (`template.ts`) are TypeScript, providing full type safety throughout your codebase.

## What This Example Shows

- ✅ Using `superimg/server` exports (PlaywrightRenderer)
- ✅ Compiling TypeScript templates programmatically with `compileTemplate()`
- ✅ Full type safety in templates (RenderContext types)
- ✅ Rendering videos programmatically
- ✅ Rendering videos server-side without a browser UI

## Prerequisites

1. Install Playwright browser (required for server-side rendering):
   ```bash
   pnpm setup
   # or
   npx playwright install chromium
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

## Usage

```bash
pnpm render
```

## How It Works

1. **Load Template**: Reads `template.ts` (TypeScript) from disk
2. **Compile Template**: Uses `compileTemplate()` to inject `std` global and validate code
   - TypeScript types in templates are for developer experience
   - `compileTemplate()` accepts code as a string, so TypeScript files work fine
3. **Render Video**: Renders template to MP4
4. **Initialize Playwright**: Launches headless Chromium browser
5. **Render Video**: Renders each frame and encodes to MP4
6. **Save Output**: Writes `output.mp4` to disk

## Code Structure

```typescript
import { renderVideo } from "superimg/server";
import { readFileSync } from "node:fs";

// Read template
const templateCode = readFileSync("template.ts", "utf-8");

// Render video
await renderVideo(templateCode, {
  output: "output.mp4",
  onProgress: (frame, total) => {
    console.log(`Frame ${frame}/${total}`);
  },
});
```

## Key Differences from `server` Example

- **TypeScript Template**: Template file is `.ts` instead of `.js`
- **Type Safety**: Full TypeScript types in template (`RenderContext`, return types)
- **Better IDE Support**: IntelliSense and type checking in templates

## Runtime Support

- ✅ **Node.js** (v18+)
- ✅ **Bun** (latest)
- ✅ **Deno** (with `--allow-read --allow-write --allow-net`)

## Notes

- The `std` global is automatically injected when using `compileTemplate()`
- TypeScript types in templates are checked at compile time (via tsconfig.json)
- At runtime, `compileTemplate()` treats the code as JavaScript (uses `new Function()`)
- Playwright must be installed separately (it's a peer dependency)
- Server-side rendering requires a headless browser (Chromium via Playwright)
