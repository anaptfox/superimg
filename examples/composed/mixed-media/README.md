# Mixed media sequence

`mixed-media.ts` keeps four authored works in one named `sequence()`, then
`mixed-media.media.ts` gives that program a 1280 × 720, 24 fps clock with
`time()`. Every beat lasts one second, so the complete composition is exactly
4 seconds (96 frames).

| Beat | Schedule at 24 fps | Authored child | Mapping | What it demonstrates |
| --- | ---: | --- | --- | --- |
| `landscape-still` | 0–23 | `image()` · 1280 × 720 | native | A landscape still already matches the output canvas. |
| `portrait-still` | 24–47 | `image()` · 720 × 1080 | `contain` | A portrait still keeps its full canvas inside the landscape output. |
| `square-video` | 48–71 | `video()` · 720 × 720 · 30 fps | explicit `cover` | A square animated child fills the output and crops its top and bottom. |
| `landscape-video` | 72–95 | `video()` · 1280 × 720 | native | A landscape animated child keeps its authored canvas and local clock. |

The two stills use an explicit `hold: "1s"`. The videos own their one-second
durations; the square child samples its 30 fps motion onto the composition's 24 fps clock. The illustrations use only
authored layout primitives, so the example has no external assets.
