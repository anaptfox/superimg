# Celadon Pavilion

A seven-second camera move through a greenhouse tea pavilion. The scene and camera are authored in Three.js; `world.ts` samples them at an absolute time and releases their resources when the surface is removed.

Run these commands from the repository root.

```sh
pnpm install --frozen-lockfile
just cli dev examples/showcase/celadon-pavilion/pavilion.media.ts
just cli export examples/showcase/celadon-pavilion/pavilion.media.ts --for 1280x720.mp4
```

The `?superimg-surface` import lets the SuperImg source compiler prepare the world
and its browser dependencies. The native world remains ordinary TypeScript.
