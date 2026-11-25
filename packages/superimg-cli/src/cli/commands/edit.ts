//! CLI registration for Edit Program interactions. Dispatch stays lazy.

import type { Command } from "commander";

export function registerEditCommands(program: Command): void {
  const edit = program
    .command("edit")
    .description(
      "Dispatch Edit Program interactions: bindings, then exact source edits with hashes",
    );

  edit
    .command("bindings")
    .description("media.edit.bindings — inspect exact, inspect-only, and opaque bindings")
    .argument("<template>", "Media name or path")
    .option("--json", "Pretty-print JSON")
    .action(async (template: string, options: { json?: boolean }) => {
      const { editBindingsCommand } = await import("./edit-dispatch.js");
      await editBindingsCommand(template, options);
    });

  edit.command("set-audio-clip-placement").description("media.edit.set-audio-clip-placement — inline audio placement in seconds").requiredOption("--command <json>", "Interaction input JSON, file path, or - for stdin").option("--json", "Pretty-print JSON").action(async (options: { command: string; json?: boolean }) => { const { editSetAudioClipPlacementCommand } = await import("./edit-dispatch.js"); await editSetAudioClipPlacementCommand(options); });

  edit.command("set-node-property").description("media.edit.set-node-property — supported literal node property").requiredOption("--command <json>", "Interaction input JSON, file path, or - for stdin").option("--json", "Pretty-print JSON").action(async (options: { command: string; json?: boolean }) => { const { editSetNodePropertyCommand } = await import("./edit-dispatch.js"); await editSetNodePropertyCommand(options); });

  edit.command("set-node-text").description("media.edit.set-node-text — literal Text child").requiredOption("--command <json>", "Interaction input JSON, file path, or - for stdin").option("--json", "Pretty-print JSON").action(async (options: { command: string; json?: boolean }) => { const { editSetNodeTextCommand } = await import("./edit-dispatch.js"); await editSetNodeTextCommand(options); });

  edit
    .command("set-node-transform")
    .description("media.edit.set-node-transform — literal Frame/Html x,y")
    .requiredOption("--command <json>", "Interaction input JSON, file path, or - for stdin")
    .option("--json", "Pretty-print JSON")
    .action(async (options: { command: string; json?: boolean }) => {
      const { editSetNodeTransformCommand } = await import("./edit-dispatch.js");
      await editSetNodeTransformCommand(options);
    });

  edit
    .command("trim-scene-end")
    .description("media.edit.trim-scene-end — literal compose() scene duration")
    .requiredOption("--command <json>", "Interaction input JSON, file path, or - for stdin")
    .option("--json", "Pretty-print JSON")
    .action(async (options: { command: string; json?: boolean }) => {
      const { editTrimSceneEndCommand } = await import("./edit-dispatch.js");
      await editTrimSceneEndCommand(options);
    });

  edit
    .command("set-phase-boundary")
    .description("media.edit.set-phase-boundary — adjacent literal director phases")
    .requiredOption("--command <json>", "Interaction input JSON, file path, or - for stdin")
    .option("--json", "Pretty-print JSON")
    .action(async (options: { command: string; json?: boolean }) => {
      const { editSetPhaseBoundaryCommand } = await import("./edit-dispatch.js");
      await editSetPhaseBoundaryCommand(options);
    });

  edit
    .command("set-composition-hold")
    .description("media.edit.set-composition-hold — literal still hold at a qualified retained-composition path")
    .requiredOption("--command <json>", "Interaction input JSON, file path, or - for stdin")
    .option("--json", "Pretty-print JSON")
    .action(async (options: { command: string; json?: boolean }) => {
      const { editSetCompositionHoldCommand } = await import("./edit-dispatch.js");
      await editSetCompositionHoldCommand(options);
    });
}
