import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { admitAll, bindProjection, directRealizationIds, type InteractionInstallation } from "@foxworth/boundary";
import { controlled, createControlRequester, digestControlRealization, type ControlPolicy } from "@foxworth/boundary/control";
import { MemoryJournal, TestClock } from "@foxworth/boundary/testing";
import { normalizeJson, type JsonObject } from "@foxworth/boundary/program";
import { MEDIA_COMPILED_INTERACTIONS } from "./compiled.js";
import { contributeMediaControlRequests } from "./control.js";
import { createMediaInteractionMount } from "./mount.js";
import { installMediaInteractions } from "./install.js";
import { projectMediaInteractions } from "./projection.js";

type Context = { actor: string };
const HASH = "a".repeat(64);
const sourceSchema = {
  type: "object", additionalProperties: false,
  required: ["source"], properties: { source: { type: "string" } },
} satisfies JsonObject;
const allowRequestOnly: ControlPolicy<string> = {
  identify: actor => actor,
  request: () => ({ allow: true }),
  approve: () => ({ allow: false, reason: "request-only fixture" }),
  grant: () => ({ allow: false, reason: "request-only fixture" }),
  execute: () => ({ allow: false, reason: "request-only fixture" }),
  reconcile: () => ({ allow: false, reason: "request-only fixture" }),
  preflight: () => undefined,
};

describe("native Control request contribution", () => {
  it("proposes with the authentic Boundary control and never runs native dispatch or apply", async () => {
    const native = vi.fn(() => { throw new Error("native dispatch must not run in request mode"); });
    const apply = vi.fn(({ input }: { input: { source: string } }) => ({
      schemaVersion: 0, kind: "media-collection-snapshot", source: input.source, sourceId: input.source,
      providerHash: HASH, snapshotDigest: HASH, entries: [],
    }));
    const plannedContexts: Context[] = [];
    const hook = controlled({
      realizationDigest: `sha256:${HASH}` as const,
      state: sourceSchema,
      preview: sourceSchema,
      plan: ({ input, context }: { input: { source: string }; context: Context }) => {
        plannedContexts.push(context);
        return {
          subject: { kind: "media-source", id: input.source },
          baseline: { source: input.source }, baselineSummary: "Snapshot requested",
          effects: [{ kind: "snapshot", action: "read", resource: input.source }], state: { source: input.source }, preview: { source: input.source },
        };
      },
      apply,
      verify: () => ({ ok: true as const }),
      reconcile: () => ({ status: "uncertain" as const }),
    });
    const handle = MEDIA_COMPILED_INTERACTIONS.handles.snapshot;
    const control = await digestControlRealization<Context>(
      { compileSchema: schema => ({ contract: schema as JsonObject }) },
      { interactionId: handle.interactionId, contractDigest: handle.contractDigest },
      hook,
    );
    let current: InteractionInstallation<Context> | undefined;
    const requester = createControlRequester<string, Context>(
      { journal: new MemoryJournal(), clock: new TestClock(100), policy: allowRequestOnly, executor: { owner: "test" } },
      {
        inspect: () => {
          if (!current) throw new Error("installation is not ready");
          return { installationId: current.installationId, installationDigest: current.manifest.installationDigest, programDigest: current.manifest.program.programDigest };
        },
        resolve: target => ({ target, hook: control.hook,
          parseInput: normalizeJson, parseState: normalizeJson, parsePreview: normalizeJson, parseOutput: normalizeJson }),
      },
    );
    const contribution = { control, executionRealizationId: "realization:snapshot:execute:1", actor: (context: Context) => context.actor };
    // A copied ResolvedControl loses Boundary provenance: old resolve/bind wrappers did this.
    expect(() => contributeMediaControlRequests(requester, { snapshot: { ...contribution, control: { ...control } } })).toThrow();
    const requests = contributeMediaControlRequests(requester, { snapshot: contribution });
    const { installation } = await installMediaInteractions(
      createMediaInteractionMount<Context>({ handlers: { discover: native, describe: native, check: native, inspect: native, snapshot: native, compile: native, thumbnail: native, arrange: native, export: native } }),
      { installationId: "deploy:request-only:1", requests,
        realizationIds: { ...directRealizationIds(MEDIA_COMPILED_INTERACTIONS, "test:1"), snapshot: { direct: "realization:snapshot:direct:1", request: "realization:snapshot:request:1" } } },
    );
    current = installation;
    const projection = await projectMediaInteractions({ snapshot: "request" });
    const bound = await bindProjection(projection, installation, { admit: admitAll });
    if (bound.status !== "bound") throw new Error("expected bound");
    expectTypeOf(projection.handles.snapshot.modes).toEqualTypeOf<readonly ["request"]>();
    expectTypeOf(bound.binding.connect()).toHaveProperty("request");
    const context = { actor: "viewer" };
    const outcome = await bound.binding.connect().requestRaw(bound.binding.resolve(handle.interactionId)!, { source: "launch" }, context);
    expect(outcome).toMatchObject({ certainty: "not-started", result: { kind: "proposed", proposal: { version: 1 } } });
    expect(plannedContexts).toEqual([context]);
    expect(plannedContexts[0]).toBe(context);
    expect(native).not.toHaveBeenCalled();
    expect(apply).not.toHaveBeenCalled();
  });
});
