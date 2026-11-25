# Arrangement Lab

A local, side-by-side prototype comparing contextual controls built directly from SuperImg arrangement schemas with the same controls rendered through a json-render catalog.

## Run

This prototype is intentionally outside the pnpm workspace package globs. It has a small, independent npm lockfile so evaluating json-render does not change the monorepo dependency graph. From this directory:

```sh
npm ci --ignore-scripts
npm run dev
```

Open [the local lab](http://127.0.0.1:4196). `npm test` runs the focused model tests. `npm run build` typechecks and builds the app. `npm run preview` serves the build at [port 4286](http://127.0.0.1:4286).

## Try it

1. Choose event overlap, screenshot comparison, process diagram, or branded social card. Both lanes start from identical illustrative data.
2. Pick a contextual section in either lane: question/evidence, shared clock, individual interval track, screenshot label/provenance, process step/connection, or card content/brand treatment.
3. Edit a field. Validation checks the draft immediately; **Apply draft** updates the accepted preview. The other lane remains independent.
4. Enter an interval end before its start or a card headline longer than 72 characters. The draft is blocked and the accepted preview remains visible. **Discard draft** recovers.
5. **Copy schema → catalog** copies the accepted baseline request. The parity label compares accepted requests, not unapplied drafts or pixels.
6. Expand **Inspect contracts & edit JSON** to inspect the pattern schema or validate a JSON draft. The catalog lane also exposes the control spec and catalog prompt.
7. **Save JSON** downloads the accepted input, not the draft. Resetting or changing examples discards local edits. No state survives a reload.

## What runs

The baseline derives controls from the existing pattern schemas and current field values. Small contextual group rules select which fields to expose. The catalog adapter derives a control spec from those same descriptors and renders it with the actual `@json-render/react` Renderer and registry. Catalog shape, structural graph, explicit component props, and allowed field bindings are checked before mounting that spec.

The three explanation examples use SuperImg's `parseArrangeRequest`, `checkArrangeRequest`, `renderArrangeRequest`, and HTML tree lowering directly from this checkout. The preview is shared by both lanes. The iframe is sandboxed; a fixed local script scales the authored canvas. Source renderer dependency resolution for this standalone app is explicit in Vite and TypeScript configuration. Rendering uses heuristic text measurement and is not the Player/accepted-frame inspection protocol.

The fourth example is a **new square card recipe**, separate from the existing arrangement registry. Its explicit schema bounds copy lengths and theme choices; its renderer uses SuperImg Frame, Fill, and Text primitives. Its saved `.recipe.json` is an input for this prototype and is **not** a portable arrangement CLI request. The other three save ordinary `.arrange.json` requests. The Northstar brand and screenshots are synthetic fixtures.

This is a deterministic editing comparison. It does not call an LLM, generate freeform interfaces, execute providers, invoke exports, or measure generation quality. The catalog prompt is inspectable but not sent to a model. Existing optional fields can be edited in JSON; the contextual editor exposes a focused subset of present fields and does not add/remove array entries or select media assets.

## Dependency evidence

Pinned packages: `@json-render/core` and `@json-render/react` 0.21.4, Zod 4.6.7, React 19.3.1. The exploratory upstream inspection used commit `277df7f26d03e45c490ffb8d11a4dde488c5f289`.

Relevant upstream evidence: [catalog validation tests](https://github.com/vercel-labs/json-render/blob/277df7f26d03e45c490ffb8d11a4dde488c5f289/packages/core/src/schema.test.ts#L552-L657), [props validation implementation](https://github.com/vercel-labs/json-render/blob/277df7f26d03e45c490ffb8d11a4dde488c5f289/packages/core/src/schema.ts#L533-L544), and [React registry/renderer test setup](https://github.com/vercel-labs/json-render/blob/277df7f26d03e45c490ffb8d11a4dde488c5f289/packages/react/src/renderer.test.tsx#L54-L109). Multi-component core catalog validation is permissive about props in that path, which is why the prototype explicitly validates each component's props and permitted field bindings. SuperImg admission remains separate.

## Scope and tradeoff

No production SuperImg package changed. Both lanes share the same content constraints and preview renderer, so the prototype does not imply that json-render improves visual quality. Its additional value here is a serializable control specification, reusable registry, and generated prompt. The direct schema path achieves the same editor behavior with less machinery. A future model comparison should hold inputs, model, validation and rendering constant and measure correction time, validity and edit preservation.

The production JS bundle is approximately 466 kB uncompressed (143 kB gzip) for this prototype. This is an observed build size, not a comparative speed result. No runtime performance benefit is claimed. Automated tests cover contract preservation, schema enum controls, targeted/stale edits, invalid admission, control binding validation, and brand constraints. Browser checks cover both paths and all four examples; encoded export, physical-device acceptance and production integration remain outside this prototype.
