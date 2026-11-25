//! Live semantic queries and mutations owned by InteractivePlayer.

import type {
  SceneCameraPatch,
  SceneNodeSnapshot,
  SceneNodeStatePatch,
  SceneOperation,
  SceneQuery,
  SceneRuntimeInput,
  SceneSnapshot,
} from "./contracts.js";
import type { JsonValue } from "@superimg/types";
import { getInteractiveSceneNode, queryInteractiveScene } from "./semantic.js";

export interface InteractiveSceneHost {
  getSnapshot(): SceneSnapshot;
  setInput(input: SceneRuntimeInput): void;
  render(): Promise<void>;
}

export class InteractiveSceneController {
  private input: SceneRuntimeInput = {};
  private readonly overrides = new Map<string, SceneNodeStatePatch>();

  constructor(private readonly host: InteractiveSceneHost) {}

  get snapshot(): SceneSnapshot {
    return this.host.getSnapshot();
  }

  get(id: string): SceneNodeSnapshot | undefined {
    return getInteractiveSceneNode(this.snapshot, id);
  }

  query(query: SceneQuery): readonly SceneNodeSnapshot[] {
    return queryInteractiveScene(this.snapshot, query);
  }

  async use(state: string): Promise<void> {
    await this.update({ ...this.input, state });
  }

  async show(target: string): Promise<void> {
    await this.apply({ type: "show", target });
  }

  async hide(target: string): Promise<void> {
    await this.apply({ type: "hide", target });
  }

  async set(target: string, value: SceneNodeStatePatch): Promise<void> {
    await this.apply({ type: "set", target, value });
  }

  async apply(...operations: readonly SceneOperation[]): Promise<void> {
    // Map insertion order preserves which unknown target rejects first. Keep
    // even empty patches: touching an unknown target must still reject.
    for (const operation of operations) {
      const value = captureOperation(operation);
      const previous = this.overrides.get(operation.target);
      this.overrides.set(operation.target, {
        ...previous,
        ...value,
        ...(value.transform !== undefined
          ? { transform: { ...previous?.transform, ...value.transform } }
          : {}),
        ...(value.properties !== undefined
          ? { properties: { ...previous?.properties, ...value.properties } }
          : {}),
      });
    }
    await this.update({
      ...this.input,
      operations: [...this.overrides].map(([target, value]) => ({
        type: "set",
        target,
        value,
      })),
    });
  }

  async camera(value: SceneCameraPatch): Promise<void> {
    await this.update({
      ...this.input,
      camera: {
        ...this.input.camera,
        ...value,
        ...(value.fit ? { fit: { ...value.fit } } : {}),
        ...(value.follow ? { follow: { ...value.follow } } : {}),
      },
    });
  }

  /** @internal Reset command history after a new definition commits, without rendering. */
  resetForDefinition(): void {
    this.input = {};
    this.overrides.clear();
  }

  async reset(): Promise<void> {
    this.resetForDefinition();
    await this.update({});
  }

  private async update(input: SceneRuntimeInput): Promise<void> {
    this.input = input;
    this.host.setInput(input);
    await this.host.render();
  }
}

/** Capture command values without baking in a frame's authored defaults. */
function captureOperation(operation: SceneOperation): SceneNodeStatePatch {
  if (operation.type === "show") return { visible: true };
  if (operation.type === "hide") return { visible: false };
  if (operation.type === "fadeIn") return {
    visible: true,
    opacity: operation.options?.progress ?? 1,
    animation: { type: "fadeIn", ...operation.options },
  };
  if (operation.type === "pulse") return {
    animation: { type: "pulse", ...operation.options },
  };
  const value = operation.value;
  return {
    ...(value.visible !== undefined ? { visible: value.visible } : {}),
    ...(value.opacity !== undefined ? { opacity: value.opacity } : {}),
    ...(value.transform !== undefined ? { transform: { ...value.transform } } : {}),
    ...(value.animation !== undefined
      ? { animation: value.animation === null ? null : { ...value.animation } }
      : {}),
    ...(value.properties !== undefined
      ? { properties: Object.fromEntries(Object.entries(value.properties).map(
          ([key, item]) => [key, captureJson(item)],
        )) }
      : {}),
  };
}

function captureJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(captureJson);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(
      ([key, item]) => [key, captureJson(item)],
    ));
  }
  return value;
}
