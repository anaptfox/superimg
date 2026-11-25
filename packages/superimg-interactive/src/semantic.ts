//! Interactive facade over the shared presentation implementation.
import type { SceneAuthoring, SceneRuntimeInput, SceneSnapshot, SceneQuery, SceneNodeSnapshot, MediaElement } from "@superimg/types";
import {
  createInteractiveSceneAuthoring as author,
  queryInteractiveScene as query,
  getInteractiveSceneNode as get,
  projectInteractiveSceneHtml as html,
  projectInteractiveSceneTree as tree,
} from "@superimg/stdlib/scene-semantic";
export function createInteractiveSceneAuthoring(sceneId = "default", runtime: SceneRuntimeInput = {}): SceneAuthoring { return author(sceneId, runtime); }
export function queryInteractiveScene(snapshot: SceneSnapshot, value: SceneQuery): readonly SceneNodeSnapshot[] { return query(snapshot, value); }
export function getInteractiveSceneNode(snapshot: SceneSnapshot, id: string): SceneNodeSnapshot | undefined { return get(snapshot, id); }
export function projectInteractiveSceneHtml(markup: string, snapshot: SceneSnapshot): string { return html(markup, snapshot); }
export function projectInteractiveSceneTree(value: MediaElement, snapshot: SceneSnapshot): MediaElement | null { return tree(value, snapshot); }
