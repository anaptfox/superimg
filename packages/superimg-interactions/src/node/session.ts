import { createRuntime } from "@superimg/core/runtime";
import { createNodeRuntimeAdapter } from "@superimg/node/runtime";
import type { Runtime } from "@superimg/types";
import {
  createNodeMediaInteractionMount,
  type CreateNodeMediaInteractionMountOptions,
} from "./mount.js";
import type { MediaInteractionMount } from "../mount.js";

export type CreateNodeMediaInteractionSessionOptions<Context> = Omit<
  CreateNodeMediaInteractionMountOptions<Context>,
  "runtime"
>;

export type NodeMediaInteractionSession<Context> = Readonly<{
  mount: MediaInteractionMount<Context>;
  runtime: Runtime;
  dispose(): Promise<void>;
}>;

/** Create a Node interaction mount and the runtime kernel it must use. */
export async function createNodeMediaInteractionSession<Context>(
  options: CreateNodeMediaInteractionSessionOptions<Context>,
): Promise<NodeMediaInteractionSession<Context>> {
  const runtime = createRuntime(createNodeRuntimeAdapter());
  try {
    const mount = createNodeMediaInteractionMount({ ...options, runtime });
    let disposal: Promise<void> | undefined;
    return Object.freeze({
      mount,
      runtime,
      dispose() {
        disposal ??= runtime.dispose();
        return disposal;
      },
    });
  } catch (error) {
    await runtime.dispose();
    throw error;
  }
}
