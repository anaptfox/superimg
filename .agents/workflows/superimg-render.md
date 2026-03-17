---
description: Render a SuperImg video template and output to an MP4.
---
This workflow streamlines rendering and previewing templates in SuperImg. 

### Rendering Process

1. Provide the name of the template directory in `examples/templates/` that you would like to test.
2. Build the `@superimg/core` and `@superimg/types` packages utilizing the `just build` or `just dev` routines outlined in `@/CLAUDE.md`.
// turbo
3. Execute the CLI render command:
```bash
node ./apps/superimg/dist/cli.js render examples/templates/<YOUR_TEMPLATE>/<YOUR_TEMPLATE>.video.ts
```
> **Note for AI Agents:** Do not supply an explicit `-o` output path to the CLI unless explicitly requested by the user. Rely on the framework's native output path resolution.
4. Verify that the video was generated successfully in the `output/` directory (located at the root level of the template's nearest enclosing `package.json`) and analyze the command output.
