---
description: Create a new SuperImg video template (single scene or multi-scene composition) inside an existing project.
---
This workflow scaffolds a new video inside an existing SuperImg project using the `superimg new` CLI command.

### Creating a New Video

1. Decide on a **video name** (kebab-case, e.g. `my-promo`), and optionally choose options ahead of time:
   - `--compose` for multi-scene composition (intro + content + outro)
   - `--tailwind` to enable Tailwind CSS utility classes
   - `--js` to use JavaScript instead of TypeScript
   - `-y` to skip interactive prompts and use defaults
// turbo
2. Run the CLI new command:
```bash
node ./apps/superimg/dist/cli.js new <VIDEO_NAME> [options]
```
   Examples:
   ```bash
   # Interactive — prompts for type, tailwind, language
   node ./apps/superimg/dist/cli.js new my-promo

   # Single scene with Tailwind, non-interactive
   node ./apps/superimg/dist/cli.js new my-promo --tailwind -y

   # Multi-scene composition
   node ./apps/superimg/dist/cli.js new my-promo --compose
   ```
3. Verify the generated files exist under `videos/<VIDEO_NAME>/`:
   - **Single scene**: `<name>.video.ts` + `_config.ts`
   - **Composition**: `<name>.video.ts` (compose entry) + `intro.video.ts` + `content.video.ts` + `outro.video.ts` + `_config.ts`
4. Preview the new video with the dev server:
```bash
node ./apps/superimg/dist/cli.js dev <VIDEO_NAME>
```
5. Edit the generated template files to customize the video content, animations, and styling.
