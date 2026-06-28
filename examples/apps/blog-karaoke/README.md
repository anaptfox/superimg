# blog-karaoke

Turn a blog post URL, HTML file, or plain text file into a karaoke-style read-along video.

This example treats video as an automated reading layer for existing writing. It fetches or reads an article, extracts readable text, estimates word timings, then renders a SuperImg template with the active word highlighted like karaoke captions. Audio is intentionally out of scope.

## Usage

From the monorepo root:

```bash
pnpm --filter blog-karaoke dev -- --text examples/apps/blog-karaoke/fixtures/sample.txt
```

With a URL:

```bash
pnpm --filter blog-karaoke dev -- https://example.com/blog/post
```

## Options

```text
blog-karaoke <url> [options]

Options:
  --text <path>          Use a local text or HTML file instead of fetching a URL
  -o, --output <file>    Output file (default: output/blog-karaoke.mp4)
  -f, --format <fmt>     horizontal | vertical | square (default: vertical)
  --wpm <number>         Estimated reading speed, 90-180 (default: 128)
  --max-words <number>   Max words to include, 40-420 (default: 140)
  -h, --help             Show help
```

## How it works

- `src/cli.ts` owns the product workflow: fetch/read, extract title/body text, estimate timings, and call `renderVideo`.
- `src/article.ts` is a deliberately dependency-free readability pass. Real apps can swap in Mozilla Readability, Mercury Parser, or an LLM cleanup step.
- `src/timing.ts` converts article text into word-level timing data.
- `src/templates/karaoke.media.ts` renders a responsive teleprompter-style video using the current word time.

## Readability defaults

The default pace is intentionally conservative: 128 wpm, with stronger pauses after punctuation and only a small phrase window on screen. For social video, the viewer is often reading on a phone while deciding whether to keep watching, so the example favors comprehension over fitting a whole post into one clip.

## Prerequisites

```bash
npx superimg setup
```
