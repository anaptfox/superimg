import type { MediaEditCommand } from "@superimg/types";
import type { EditInteractionHandlers } from "./contracts.js";
import {
  createEditInteractionMount,
  type CreateEditInteractionMountOptions,
  type EditInteractionMount,
} from "./mount.js";
import {
  NodeEditEngine,
  type NodeEditEngineOptions,
} from "./node-engine.js";

export type CreateNodeEditInteractionMountOptions<Context> =
  Omit<CreateEditInteractionMountOptions<Context>, "handlers"> & (
    | NodeEditEngineOptions<Context>
    | Readonly<{ engine: NodeEditEngine<Context> }>
  );

export function createNodeEditInteractionMount<Context>(
  options: CreateNodeEditInteractionMountOptions<Context>,
): EditInteractionMount<Context> {
  const engine = "engine" in options ? options.engine : new NodeEditEngine(options);
  const execute = (command: MediaEditCommand, context: Context) => engine.execute(command, context);
  const handlers: EditInteractionHandlers<Context> = {
    bindings({ input, context }) {
      return engine.bindings(input.source, context);
    },
    setAudioClipPlacement({ input, context }) { return execute(input, context); },
    setNodeProperty({ input, context }) { return execute(input, context); },
    setNodeText({ input, context }) { return execute(input, context); },
    setNodeTransform({ input, context }) {
      return execute(input, context);
    },
    trimSceneEnd({ input, context }) {
      return execute(input, context);
    },
    setPhaseBoundary({ input, context }) {
      return execute(input, context);
    },
    setCompositionHold({ input, context }) {
      return execute(input, context);
    },
  };
  return createEditInteractionMount({ handlers });
}
