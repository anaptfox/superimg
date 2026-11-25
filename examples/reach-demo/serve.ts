/**
 * Live Media Binding for the Reach demo: HTTP Handoff plus a Reach record.
 * Host stays sovereign. The bus only holds the address.
 */
import { createServer } from "node:http";
import {
  controlled,
  createControlRequester,
  digestControlRealization,
  type ControlPolicy,
} from "@foxworth/boundary/control";
import { MemoryJournal, TestClock } from "@foxworth/boundary/testing";
import {
  admitAll,
  bindProjection,
  directRealizationIds,
  type InteractionInstallation,
} from "@foxworth/boundary";
import { createProtocolHandler } from "@foxworth/boundary/http";
import { sendFetchResponse, toFetchRequest } from "@foxworth/boundary/http/node";
import { createReachRecord } from "@foxworth/boundary/reach";
import { normalizeJson, type JsonObject } from "@foxworth/boundary/program";
import { createRuntime } from "@superimg/core/runtime";
import { createNodeRuntimeAdapter } from "@superimg/node/runtime";
import {
  MEDIA_COMPILED_INTERACTIONS,
  contributeMediaControlRequests,
  createNodeMediaInteractionMount,
  installMediaInteractions,
  projectMediaOffer,
} from "@superimg/interactions";

const PROTOCOL_PATH = "/boundary/v1";
const HASH = "c".repeat(64);
const objectSchema = {
  type: "object",
  additionalProperties: true,
} satisfies JsonObject;

const requestOnly: ControlPolicy<string> = {
  identify: (actor) => actor,
  request: () => ({ allow: true }),
  approve: () => ({ allow: false, reason: "demo request-only" }),
  grant: () => ({ allow: false, reason: "demo request-only" }),
  execute: () => ({ allow: false, reason: "demo request-only" }),
  reconcile: () => ({ allow: false, reason: "demo request-only" }),
  preflight: () => undefined,
};

export type LiveMediaSurface = Readonly<{
  url: string;
  bindingDigest: string;
  interactionIds: readonly string[];
  record: Awaited<ReturnType<typeof createReachRecord>>;
  stop(): Promise<void>;
}>;

async function requestControl<Context>(
  alias: "snapshot" | "compile" | "export",
) {
  const handle = MEDIA_COMPILED_INTERACTIONS.handles[alias];
  const hook = controlled({
    realizationDigest: `sha256:${HASH}` as const,
    state: objectSchema,
    preview: objectSchema,
    plan: ({ input }: { input: JsonObject }) => ({
      subject: { kind: "media", id: alias },
      baseline: {},
      baselineSummary: alias,
      effects: [],
      state: input,
      preview: input,
    }),
    apply: () => {
      throw new Error(`${alias} must not apply in this demo`);
    },
    verify: () => ({ ok: true as const }),
    reconcile: () => ({ status: "uncertain" as const }),
  });
  return digestControlRealization<Context>(
    { compileSchema: (schema) => ({ contract: schema as JsonObject }) },
    { interactionId: handle.interactionId, contractDigest: handle.contractDigest },
    hook,
  );
}

export async function startLiveMediaOffer(projectRoot: string): Promise<LiveMediaSurface> {
  type Context = { actor: string };
  const runtime = createRuntime(createNodeRuntimeAdapter());
  const mount = createNodeMediaInteractionMount<Context>({
    projectRoot,
    runtime,
  });
  const snapshot = await requestControl<Context>("snapshot");
  const compile = await requestControl<Context>("compile");
  const exported = await requestControl<Context>("export");

  let current: InteractionInstallation<Context> | undefined;
  const requester = createControlRequester<string, Context>(
    {
      journal: new MemoryJournal(),
      clock: new TestClock(1),
      policy: requestOnly,
      executor: { owner: "reach-demo" },
    },
    {
      inspect: () => {
        if (!current) throw new Error("installation is not ready");
        return {
          installationId: current.installationId,
          installationDigest: current.manifest.installationDigest,
          programDigest: current.manifest.program.programDigest,
        };
      },
      resolve: (target) => ({
        target,
        hook:
          target.interactionId === "media.collection.snapshot"
            ? snapshot.hook
            : target.interactionId === "media.artifact.compile"
              ? compile.hook
              : exported.hook,
        parseInput: normalizeJson,
        parseState: normalizeJson,
        parsePreview: normalizeJson,
        parseOutput: normalizeJson,
      }),
    },
  );
  const actor = (context: Context) => context.actor;
  const requests = contributeMediaControlRequests(requester, {
    snapshot: {
      control: snapshot,
      executionRealizationId: "realization:snapshot:execute:1",
      actor,
    },
    compile: {
      control: compile,
      executionRealizationId: "realization:compile:execute:1",
      actor,
    },
    export: {
      control: exported,
      executionRealizationId: "realization:export:execute:1",
      actor,
    },
  });
  const directs = directRealizationIds(MEDIA_COMPILED_INTERACTIONS, "demo:1");
  const { installation, controller } = installMediaInteractions(mount, {
    installationId: "superimg-demo:media",
    requests,
    realizationIds: {
      ...directs,
      snapshot: { ...directs.snapshot, request: "realization:snapshot:request:1" },
      compile: { ...directs.compile, request: "realization:compile:request:1" },
      export: { ...directs.export, request: "realization:export:request:1" },
    },
  });
  current = installation;
  const projection = projectMediaOffer();
  const bound = bindProjection(projection, installation, { admit: admitAll });
  if (bound.status !== "bound") {
    controller.revoke();
    throw new Error(
      `Media Offer did not bind: ${bound.report.issues.map((issue) => issue.reason).join(", ")}`,
    );
  }
  const handler = createProtocolHandler({
    binding: bound.binding,
    path: PROTOCOL_PATH,
    context: () => ({ actor: "demo" }),
  });
  const server = createServer((incoming, outgoing) => {
    void (async () => {
      const request = toFetchRequest(incoming, { origin: "http://127.0.0.1" });
      const response = await handler(request);
      await sendFetchResponse(outgoing, response, incoming.method);
    })();
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("demo server did not bind");
  }
  const url = `http://127.0.0.1:${address.port}${PROTOCOL_PATH}`;
  const record = await createReachRecord(
    bound.binding.manifest.bindingDigest,
    "superimg-demo:media",
    [{ kind: "http", url }],
  );
  return {
    url,
    bindingDigest: record.bindingDigest,
    interactionIds: projection.manifest.interactions.map((interaction) => interaction.interactionId),
    record,
    async stop() {
      bound.controller.revoke();
      controller.revoke();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
      await runtime.dispose();
    },
  };
}
