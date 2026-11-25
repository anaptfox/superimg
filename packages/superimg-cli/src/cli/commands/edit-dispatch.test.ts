import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  createCliEditInteractionMount: vi.fn(),
  findProjectRoot: vi.fn(() => "/project"),
  resolveTemplatePath: vi.fn(() => "/project/scene.media.ts"),
}));

vi.mock("../utils/edit-source.js", () => ({
  createCliEditInteractionMount: mocks.createCliEditInteractionMount,
}));

vi.mock("../utils/find-project-root.js", () => ({
  findProjectRoot: mocks.findProjectRoot,
}));

vi.mock("../utils/resolve-template.js", () => ({
  resolveTemplatePath: mocks.resolveTemplatePath,
}));

import {
  editBindingsCommand,
  editSetCompositionHoldCommand,
  editSetNodeTransformCommand,
  editSetNodeTextCommand,
  editSetNodePropertyCommand,
  editSetAudioClipPlacementCommand,
} from "./edit-dispatch.js";

beforeEach(() => {
  mocks.dispatch.mockReset().mockResolvedValue({
    schemaVersion: 0,
    kind: "media-edit-bindings",
    source: "scene.media.ts",
    sourceId: "scene",
    manifest: { bindings: [] },
    sourceHashes: { "scene.media.ts": "a".repeat(64) },
  });
  mocks.createCliEditInteractionMount.mockReset().mockReturnValue({
    dispatch: mocks.dispatch,
  });
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("edit CLI dispatch", () => {
  it("dispatches bounded property and audio placement commands", async () => {
    const expected = { intentHash: "a".repeat(64), sourceHashes: {} };
    const property = { schemaVersion: 0, source: "scene.media.ts", kind: "set-node-property", target: { nodeId: "intro::title", property: "color", bindingId: "intro::title#property.color" }, value: { value: "#fff" }, expected };
    await editSetNodePropertyCommand({ command: JSON.stringify(property) });
    expect(mocks.dispatch).toHaveBeenCalledWith({ interactionId: "media.edit.set-node-property", input: property }, {});
    const placement = { schemaVersion: 0, source: "scene.media.ts", kind: "set-audio-clip-placement", target: { clipId: "voice", bindingId: "audio::voice#placement.at" }, value: { atSeconds: 1 }, expected };
    await editSetAudioClipPlacementCommand({ command: JSON.stringify(placement) });
    expect(mocks.dispatch).toHaveBeenCalledWith({ interactionId: "media.edit.set-audio-clip-placement", input: placement }, {});
  });
  it("dispatches an exact text command", async () => {
    const command = { schemaVersion: 0, source: "scene.media.ts", kind: "set-node-text", target: { nodeId: "intro::title", textBindingId: "intro::title#text" }, value: { text: "Hello" }, expected: { intentHash: "a".repeat(64), sourceHashes: {} } };
    await editSetNodeTextCommand({ command: JSON.stringify(command) });
    expect(mocks.dispatch).toHaveBeenCalledWith({ interactionId: "media.edit.set-node-text", input: command }, {});
  });
  it("dispatches media.edit.bindings for a resolved source", async () => {
    await editBindingsCommand("scene.media.ts", { json: true });
    expect(mocks.dispatch).toHaveBeenCalledWith({
      interactionId: "media.edit.bindings",
      input: { source: "scene.media.ts" },
    }, {});
  });

  it("dispatches set-node-transform from command JSON", async () => {
    mocks.dispatch.mockResolvedValue({
      schemaVersion: 0,
      transaction: { state: "committed" },
    });
    const command = {
      schemaVersion: 0,
      source: "scene.media.ts",
      kind: "set-node-transform",
      target: {
        nodeId: "intro::title",
        xBindingId: "intro::title#initial.transform.x",
        yBindingId: "intro::title#initial.transform.y",
      },
      value: { x: 30, y: 40 },
      expected: {
        intentHash: "a".repeat(64),
        sourceHashes: { "scene.media.ts": "b".repeat(64) },
      },
    };
    await editSetNodeTransformCommand({ command: JSON.stringify(command) });
    expect(mocks.dispatch).toHaveBeenCalledWith({
      interactionId: "media.edit.set-node-transform",
      input: { ...command, source: "scene.media.ts" },
    }, {});
  });

  it("rejects a command whose kind does not match the subcommand", async () => {
    await expect(editSetNodeTransformCommand({
      command: JSON.stringify({
        source: "scene.media.ts",
        kind: "trim-scene-end",
      }),
    })).rejects.toThrow(/set-node-transform/);
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it("dispatches a qualified retained-composition hold command", async () => {
    mocks.dispatch.mockResolvedValue({ schemaVersion: 0, transaction: { state: "committed" } });
    const command = {
      schemaVersion: 0,
      source: "scene.media.ts",
      kind: "set-composition-hold",
      target: { occurrencePath: "chapter/card", holdBindingId: "chapter/card#hold" },
      value: { hold: "2s" },
      expected: {
        intentHash: "a".repeat(64),
        sourceHashes: { "scene.media.ts": "b".repeat(64) },
      },
    };
    await editSetCompositionHoldCommand({ command: JSON.stringify(command) });
    expect(mocks.dispatch).toHaveBeenCalledWith({
      interactionId: "media.edit.set-composition-hold",
      input: { ...command, source: "scene.media.ts" },
    }, {});
  });
});
