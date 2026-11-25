# Request journey

A four-step interactive lesson, hosted with `createInteractivePlayer()` and guide navigation. `main.ts` loads the same `request-journey.media.ts` definition; the buttons select its existing guide steps.

From the repository root after installing dependencies and building SuperImg:

```sh
pnpm exec vite examples/basics/request-journey --host 127.0.0.1 --port 4188
```

Open the printed local URL and select DNS, Connect, Server, or Response. Keyboard users can tab to each button and press Enter or Space.

Interactive definitions are host-driven. CLI `check` validates the contract; `inspect --png` and deterministic export intentionally do not produce an interactive artifact. The browser host is the runnable preview.

With that host running, verify all four visible states and normal pointer navigation:

```sh
node examples/basics/request-journey/request-journey.browser.mjs
```
