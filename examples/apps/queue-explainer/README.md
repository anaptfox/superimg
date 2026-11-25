# Queue Lab

An interruptible queue explanation built entirely as a SuperImg example app.
Watch evenly spaced jobs arrive, halve the workers, highlight the backlog, and
pause for an explanation computed from the exact current frame.

## Run

From the repository root, using the repository's Node and pnpm versions:

```sh
pnpm install
just build-render
pnpm --filter superimg-example-queue-explainer dev
```

Open http://127.0.0.1:4183. Direct controls work without an API key.
The scene starts paused and plays once over 24 simulated seconds. Changing workers
or arrival rate restarts the scenario; it compares conditions from time zero,
rather than changing the staffing of an already-running queue.

## Optional AI control

Set `OPENAI_API_KEY` and `OPENAI_MODEL` in the server environment, or in
`examples/apps/queue-explainer/.env.local`, then restart the dev server. Choose a
Responses API model supporting strict structured outputs. Do not use `VITE_`
prefixes for credentials. The UI shows whether the server is configured.

Try:

- “What if we had half as many workers?”
- “Set arrivals to three jobs per second.”
- “Highlight the backlog.”
- “Pause and explain this.”
- “Replay.”

The model translates one request into one bounded direction. It cannot run code,
change the render function, or supply queue counts. Explanations come from the
local model. Unsupported requests leave state unchanged. Model calls time out
after 20 seconds. A newer direct action or cancellation invalidates an older
reply. The app sends only the current queue inputs and the current text request;
there is no retained model conversation.

The AI endpoint is local Vite development middleware, not a production backend.
Production builds retain direct controls but have no AI endpoint. The key and
model configuration remain on the server. Responses API reference:
https://developers.openai.com/api/docs/guides/structured-outputs

## What this tests

Compare buttons/sliders against natural-language direction on the same tasks:

1. Start with four workers and two arrivals/second. Predict whether a backlog forms.
2. Halve the workers. Pause at 12 seconds and explain what changed.
3. Find a configuration that keeps up with three arrivals/second.
4. Highlight the waiting work, replay, and pause at a chosen moment.

Alternate which input method a participant tries first. Observe task completion,
wrong interpretations, time waiting, and whether the participant can explain the
capacity relationship afterward. “Download JSON” saves accepted commands,
scenario times, before/after inputs, failures, cancellation, and AI response
latency for comparison. This is an experiment record, not an importable recording
or a claim of pixel-identical session replay. Keep participant notes separately.

A useful next step requires people to understand the explanation better or direct
it more easily than they can with controls. There is no arbitrary next-scene
generation or speech input in this first experiment.

## Boundaries

- `src/model.ts`: deterministic FIFO simulation, fixed two-second service,
  evenly spaced arrivals, empty initial system, unlimited waiting space.
- `src/queue.media.ts`: pure SuperImg interactive definition and semantic nodes.
- `src/commands.ts`: shared bounded directions and stale-response gate.
- `src/main.ts`: application state, playback controls, request lifecycle, record.
- `src/director.server.ts` + `vite.config.ts`: optional server-only AI adapter.

No SuperImg core APIs were added. The host supplies data through the existing
interactive player. Model calls never happen inside frame evaluation.

## Verify

```sh
pnpm --filter superimg-example-queue-explainer test
pnpm --filter superimg-example-queue-explainer build
just cli check examples/apps/queue-explainer/src/queue-preview.media.ts --pretty
```

Tests cover conservation, service boundaries, deterministic replay, equivalent
control paths, invalid commands, stale requests, refusals, and provider failures.
Adapter tests use controlled responses; a live model call requires credentials.

`queue-preview.media.ts` uses the public lowering helper for offline exports of
the authored scenario. Direct `queue.media.ts` checks also work. The lowered
preview can report opaque-region warnings because interactive lowering wraps the
rendered tree in HTML; these checks do not prove internal geometry. Browser
checks verify the visible counts and interactions.
