# Security

SuperImg is a **local media compiler**. `check`, `inspect`, `dev`, and `export`
load first-party `*.media.ts` and run it. Treat untrusted templates the way you
treat untrusted source you would `node` directly.

## Trust boundary

| Surface | What runs | Isolation |
|---|---|---|
| CLI compile (`compileTemplate`) | Bundled template via `new Function` in the CLI process | Same uid as the CLI |
| `--data` scripts | Rolldown + dynamic `import` of the data module | Same uid as the CLI |
| Collection providers | Child Node (`--eval` worker), cwd beside the media file | Process + timeout + IPC size; **env allowlist** |
| Export Chromium | `Html()` markup, including `<script>` (Three / Lottie / WebGL) | Headless Chromium, no `--no-sandbox` |
| Production Player (`render-only`) | Sanitized fragment (`stripHtml`, no `allow-scripts`) | DOMPurify. CSS `url()` is residual — see `sanitize-html.ts` |
| Dev Player | Scripts re-executed after morphdom | First-party islands only |

Do not feed untrusted templates, `--data` modules, or collection providers into
the CLI. Player embeds are the sanitizing surface; export is not.

## Export paths

Rendition paths are confined with `confinedPath` (no `..`, no absolute, no
backslash). Published bundles reject symlinks in artifact paths. `--output` is
a caller-chosen directory, not a jail.

## Chromium

`just cli doctor --json` first. Run setup only on `CHROMIUM_MISSING`.
`CHROMIUM_LAUNCH_DENIED` means the binary is present but the OS sandbox blocked
launch — leave the sandbox; do not re-install or add `--no-sandbox`.

## Client packages

`superimg` browser / player graphs must not import `playwright`,
`node:child_process`, or `ffmpeg`. Enforced by `package-boundaries.test.ts`.
