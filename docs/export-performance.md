# Export performance

Use an installed CLI and unchanged media to compare exports. Keep dimensions, frame rate, encoding quality, audio, runtime and resource bytes fixed. Time the full command, including startup and bundle publication; renderer and encoder spans overlap and must not be added together.

```sh
superimg export brand/reel.media.ts --for 1080x1920.mp4 --capture-cache
```

`--capture-cache` opts into session-local reuse of unchanged static captures through `encoding.capture.cache`. It does not skip authored frame evaluation, animation sampling, asset readiness, cancellation checks or encoder timestamps. One captured buffer is retained per renderer, and callers receive owned bytes. Capture dimensions, intermediate format, alpha, quality and density remain part of the reuse decision.

The Chromium backend checks the prepared page's markup, stylesheet rules and media conditions, geometry, scroll and interaction state, loaded font identities and active paint resources. Scripts taint reuse for that renderer's lifetime. Canvas, media, image resources, shadow DOM, custom elements, forms, CSS/SMIL animation and generated content capture normally. These restrictions intentionally prefer a miss over stale pixels; some otherwise-static templates will not benefit. Layout reconciliation remains a SnapDOM-only capability.

Chromium capture seeks authored animation time explicitly and awaits required resources. It does not wait for two browser animation frames twice per exported frame. Browser animation time is separate from the authored frame clock.

For a performance change, compare all decoded video frames and audio with the baseline, repeat in fresh processes, and retain exact package identities. A faster export of one reel is not a general renderer benchmark. SnapDOM's DOM serialization and Chromium's composited screenshot path have different fidelity and resource behavior; choose a backend by the required output and measured workload, rather than assuming one is universally faster.
