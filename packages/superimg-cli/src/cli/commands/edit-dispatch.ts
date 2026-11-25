//! Trusted CLI dispatch of Edit Program interactions.

import { readFile } from "node:fs/promises";
import { dirname, relative, sep } from "node:path";
import { formatError } from "@superimg/core/errors";
import {
  EDIT_INTERACTION_IDS,
  type EditInteractionId,
  type EditInteractionRequestFor,
} from "@foxworth/superimg-interactions";
import { findProjectRoot } from "../utils/find-project-root.js";
import { createCliEditInteractionMount } from "../utils/edit-source.js";
import { resolveTemplatePath } from "../utils/resolve-template.js";

export interface EditJsonOptions {
  json?: boolean;
}

export async function editBindingsCommand(
  template: string,
  options: EditJsonOptions = {},
): Promise<void> {
  const templatePath = resolveTemplatePath(template);
  const projectRoot = findProjectRoot(dirname(templatePath));
  const source = relative(projectRoot, templatePath).split(sep).join("/");
  await dispatchEdit(
    projectRoot,
    { interactionId: EDIT_INTERACTION_IDS.bindings, input: { source } },
    options,
  );
}

export async function editSetAudioClipPlacementCommand(options: EditJsonOptions & { command: string }): Promise<void> { await dispatchMutating(EDIT_INTERACTION_IDS.setAudioClipPlacement, options); }

export async function editSetNodePropertyCommand(options: EditJsonOptions & { command: string }): Promise<void> { await dispatchMutating(EDIT_INTERACTION_IDS.setNodeProperty, options); }

export async function editSetNodeTextCommand(options: EditJsonOptions & { command: string }): Promise<void> { await dispatchMutating(EDIT_INTERACTION_IDS.setNodeText, options); }

export async function editSetNodeTransformCommand(
  options: EditJsonOptions & { command: string },
): Promise<void> {
  await dispatchMutating(EDIT_INTERACTION_IDS.setNodeTransform, options);
}

export async function editTrimSceneEndCommand(
  options: EditJsonOptions & { command: string },
): Promise<void> {
  await dispatchMutating(EDIT_INTERACTION_IDS.trimSceneEnd, options);
}

export async function editSetPhaseBoundaryCommand(
  options: EditJsonOptions & { command: string },
): Promise<void> {
  await dispatchMutating(EDIT_INTERACTION_IDS.setPhaseBoundary, options);
}

export async function editSetCompositionHoldCommand(
  options: EditJsonOptions & { command: string },
): Promise<void> {
  await dispatchMutating(EDIT_INTERACTION_IDS.setCompositionHold, options);
}

async function dispatchMutating(
  interactionId: Exclude<EditInteractionId, typeof EDIT_INTERACTION_IDS.bindings>,
  options: EditJsonOptions & { command: string },
): Promise<void> {
  const input = await loadCommandJson(options.command);
  if (!isRecord(input) || typeof input.source !== "string" || !input.source.trim()) {
    throw new Error(`${interactionId} command JSON needs a non-empty string source`);
  }
  if (input.kind !== undefined && input.kind !== interactionKind(interactionId)) {
    throw new Error(
      `${interactionId} command kind must be ${JSON.stringify(interactionKind(interactionId))}`,
    );
  }
  const templatePath = resolveTemplatePath(input.source);
  const projectRoot = findProjectRoot(dirname(templatePath));
  const source = relative(projectRoot, templatePath).split(sep).join("/");
  await dispatchEdit(
    projectRoot,
    { interactionId, input: { ...input, source } } as EditInteractionRequestFor<typeof interactionId>,
    options,
  );
}

async function dispatchEdit<Id extends EditInteractionId>(
  projectRoot: string,
  request: EditInteractionRequestFor<Id>,
  options: EditJsonOptions,
): Promise<void> {
  const mount = createCliEditInteractionMount(projectRoot);
  try {
    const output = await mount.dispatch(request, {});
    const body = options.json ? JSON.stringify(output, null, 2) : JSON.stringify(output);
    process.stdout.write(`${body}\n`);
  } catch (error) {
    const formatted = formatError(error);
    if (options.json || !process.stdout.isTTY) {
      process.stdout.write(`${JSON.stringify({ ok: false, error: formatted.json })}\n`);
    } else {
      console.error(formatted.plain);
    }
    process.exitCode = 1;
  }
}

async function loadCommandJson(spec: string): Promise<unknown> {
  const trimmed = spec.trim();
  if (trimmed === "-") {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  }
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);
  return JSON.parse(await readFile(trimmed, "utf8"));
}

function interactionKind(
  interactionId: Exclude<EditInteractionId, typeof EDIT_INTERACTION_IDS.bindings>,
): "set-audio-clip-placement" | "set-node-property" | "set-node-text" | "set-node-transform" | "trim-scene-end" | "set-phase-boundary" | "set-composition-hold" {
  if (interactionId === EDIT_INTERACTION_IDS.setAudioClipPlacement) return "set-audio-clip-placement";
  if (interactionId === EDIT_INTERACTION_IDS.setNodeProperty) return "set-node-property";
  if (interactionId === EDIT_INTERACTION_IDS.setNodeText) return "set-node-text";
  if (interactionId === EDIT_INTERACTION_IDS.setNodeTransform) return "set-node-transform";
  if (interactionId === EDIT_INTERACTION_IDS.trimSceneEnd) return "trim-scene-end";
  if (interactionId === EDIT_INTERACTION_IDS.setPhaseBoundary) return "set-phase-boundary";
  return "set-composition-hold";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
