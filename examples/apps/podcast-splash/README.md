# Podcast Splash Collection

One responsive video program materialized once per speaker.

```ts
export default collection({
  entries: loadSpeakers,
  entryId: "slug",
  media: splash,
});
```

`loadSpeakers` lives in `src/speakers.server.ts`. The compiler removes that provider and its JSON/Node dependencies from browser programs. Each unchanged speaker object becomes `ctx.data` for one export entry.

```bash
superimg export examples/apps/podcast-splash/src/templates/splash.media.ts \
  --for youtube \
  --for tiktok
```

Each seven-second splash uses typed `Frame`, `Stack`, `Text`, and `Image` nodes. The root render adapts to landscape and portrait canvases; an explicit square edition records the authored square target. Empty photos show the speaker's initials, so the included data works without remote images.

The provider validates speaker fields and unique slugs, then resolves once for the complete command. `Speaker` lives in a separate type-only module so browser hosts can share the data shape without importing the provider.

For a quick still preview of every speaker:

```bash
superimg export examples/apps/podcast-splash/src/templates/splash.media.ts \
  --for 1280x720.png --for 720x1280.png --at 3s
```
