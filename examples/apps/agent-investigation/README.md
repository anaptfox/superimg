# Agent investigation

A browser demo of SuperImg's JSON arrangement admission, pattern rendering,
Player, and browser runtime exports. Every visual inside the paper stage is
produced by `arrange.renderRequest`; the surrounding controls are ordinary HTML.

From the repository root:

```bash
just build-render
pnpm exec vite examples/apps/agent-investigation --config examples/apps/agent-investigation/vite.config.ts
```

Open http://127.0.0.1:4189. Reveal the final test, inspect the mechanism, then
compare the original and batch schedules. Change build duration to see when
saving worker time also changes the final completion time. The request editor
runs the real SuperImg parser and admission checks; an invalid edge is refused
while the previous accepted picture remains visible.

Both export buttons run `@foxworth/superimg/runtime` in the browser, using the currently
accepted request. PNG captures the current explanation time; WebM exports the
six-second context/predict/reveal sequence. The dev server serves assets only.
No AI service or backend renderer is involved.

The sample is a deterministic hypothetical model, not a measured execution.
One build worker and one test worker process three revisions. Edits finish at
2, 5, and 8 minutes; tests take 2 minutes. The batch alternative waits for the
last edit. Feedback benefits, cancellation, and failures are not modeled.
The labeled 24-minute view window is a scale reference, not a work interval.

```bash
node scripts/typecheck-native.mjs --project examples/apps/agent-investigation/tsconfig.json --noEmit
pnpm exec vitest run examples/apps/agent-investigation/src/model.test.ts
just cli check examples/apps/agent-investigation/src/investigation.media.ts
just cli export examples/apps/agent-investigation/src/investigation.media.ts --for 1100x620.png --at 4.5s
```

The CLI example exports the default timeline request. Download a different
request from the browser to use the JSON door directly:

```bash
just cli check agent-compare.json
just cli export agent-compare.json --for 1100x620.png --at 4.5s
```

The `requests/` directory includes all three default requests for CLI use.
Verified locally: typecheck, production browser build, four model/admission
tests, CLI check, JSON-door admission and PNG export, and live browser PNG
and WebM exports. The live browser check also covered prediction/reveal,
one- and six-minute build durations, and refusal with the accepted picture
preserved. No full monorepo gate was run for this example.
