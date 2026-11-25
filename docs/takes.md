# Takes

`superimg export` records a take with the media source, its local imports, its declared local audio, asset, and font files (including a `film({ score })` track and co-located `assets/` files inside the project), and the exported rendition hashes. A take stores code up to 8 MiB and media (audio, video, images, fonts) up to 256 MiB; a larger file records its SHA-256 hash and an omit reason instead of its bytes. Stored files are kept by content hash, so a score shared by many takes is stored once. Add `--label` to give the take a name. Exporting the same files again keeps the take's feedback. Media under `scratch/` skips take recording.

```bash
superimg export media/intro.media.ts --for youtube --output output/preview.mp4 --label "cut 3"
superimg takes
superimg takes media/intro.media.ts
superimg takes feedback "cut 3" --good "Clear opening" --bad "End card is too fast" --note "Review the ending" --label "opening approved"
```

`--good` and `--bad` append feedback and can be repeated. `--note` replaces the note. Use `--label ""` to clear a label. Commands that take an ID also accept a unique ID prefix or label. Use `--media` on `feedback`, `show`, or `restore` to narrow the lookup to a file or directory.

```bash
superimg takes show "opening approved" intro.media.ts
superimg takes restore "opening approved"
superimg takes from output/preview.mp4
```

`show` prints a saved file. `restore` saves your current sources and local media files as a take before writing the selected version back, bringing back recorded scores, assets, and fonts alongside code (omitted oversized files are skipped). It never writes outside the project. `from` looks up an exported file by its SHA-256 hash, so it also works on an unchanged copy of that file.

Takes live in `.superimg/takes/` next to the media source. Schema 1 records package names and versions in place of copies of dependency library files.
