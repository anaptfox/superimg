---
description: Run the SuperImg local Dev Server to preview templates and inspect HTML frames.
---
This workflow outlines the steps to start the SuperImg local development server, which provides a UI for playing templates, viewing the live HTML DOM frame-by-frame, and exporting videos.

### Dev Server Process

1. Provide the path of the media file you would like to test (for example, `examples/basics/hello-world/hello-world.media.ts`).
2. Build the necessary packages, such as utilizing the `just build` or `just dev` routines outlined in `CLAUDE.md`.
// turbo
3. Run the CLI dev command:
```bash
node ./packages/superimg-cli/dist/cli.js dev <PATH_TO_MEDIA>
```
4. Open the provided `http://localhost:8080/` URL in the browser to view the Dev Server UI.
5. Interact with the video player and use the Dev UI inspector panel (`</>` button) to debug the raw `compositeHtml` frames if needed.
