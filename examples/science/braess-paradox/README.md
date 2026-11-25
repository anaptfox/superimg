# The Shortcut That Made Everyone Slower

A 70-second, 1080p SuperImg film about Braess's paradox. Viewers predict what a free road will do, watch the new equilibrium, then see why a driver cannot escape it alone.

The film uses native `video`, `Frame`, `Text`, `Vector`, a director with seven phases, and authored audio clips. SuperImg renders and encodes the MP4.

## Reproduce from the repository root

```sh
pnpm exec tsx examples/science/braess-paradox/make-audio.mts
pnpm exec tsc -p examples/science/braess-paradox/tsconfig.json
pnpm exec vitest run examples/science/braess-paradox/model.test.ts
just cli check examples/science/braess-paradox/braess-paradox.media.ts
just cli export examples/science/braess-paradox/braess-paradox.media.ts --for youtube
just cli export examples/science/braess-paradox/thumbnail.media.ts --for 1920x1080.png
cp examples/science/braess-paradox/screening.html output/examples/science/braess-paradox/index.html
python3 -m http.server 4190 --bind 127.0.0.1 --directory output/examples/science/braess-paradox
```

Open http://127.0.0.1:4190 to watch the encoded MP4. The export receipts and files are under `output/examples/science/braess-paradox/`.

Audio generation uses macOS `say` with the Samantha voice and local `ffmpeg`. The quiet score is original PCM synthesis. The generator freezes compressed audio as portable data URLs, so the finished media definition does not depend on a local asset server. Intermediate AIFF/WAV files are reproducible scratch assets. The voice is synthetic.

The Samantha track is local draft narration. Apple's standard [macOS license, section 2F](https://www.apple.com/legal/sla/docs/macOSTahoe.pdf) restricts System Voice content to personal, non-commercial use and restricts public sharing. Replace this track with appropriately licensed narration before a public release.

## Model and source

This is the 4,000-driver example in David Easley and Jon Kleinberg, *Networks, Crowds, and Markets*, [Chapter 8, pages 230–232](https://www.cs.cornell.edu/home/kleinber/networks-book/networks-book-ch08.pdf). See also [Braess, Nagurney, and Wakolbinger's translation](https://pubsonline.informs.org/doi/10.1287/trsc.1050.0127) of the original paper.

Two roads cost `x / 100` minutes; two cost 45 minutes. Before the one-way A→B shortcut, an even split costs 65 minutes. With the zero-time shortcut, all flow takes the zigzag, costing 80. Holding the other traffic fixed, an original route costs 85. Removing the shortcut restores the 65-minute equilibrium.

The arithmetic uses a continuum approximation: each individual driver is too small to change road costs. The one-driver 40-minute temptation is therefore labeled approximate. Animated route traces show choices, not simulated physical traffic. The film compares equilibria; it does not claim 65 is the socially optimal flow when the shortcut remains open.

## YouTube packaging

**Title:** The Shortcut That Made Everyone Slower

**Thumbnail:** A FREE ROAD. A SLOWER TRIP. / 65 → 80

**Description:** Would a road that takes zero minutes make your commute faster? In this network, it makes every driver slower. Predict the outcome, then follow the route choices behind Braess's paradox: how a rational choice for each person can produce a worse result for everyone.

Based on the 4,000-driver example in Easley and Kleinberg, *Networks, Crowds, and Markets*, Chapter 8: https://www.cs.cornell.edu/home/kleinber/networks-book/networks-book-ch08.pdf

Visuals and MP4 export made with SuperImg. Synthetic narration and original synthesized score. The files are prepared locally; nothing has been uploaded to YouTube.
