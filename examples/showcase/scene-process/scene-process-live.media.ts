import { defineInteractive } from "@foxworth/superimg/interactive/define";
import { INITIAL_PROCESS, type ProcessData } from "./model";
import { renderProcess } from "./scene";

/** Guide navigation does not advance the process or accept a stamp result. */
export default defineInteractive<ProcessData>({
  size: { width: 640, height: 360 }, sample: INITIAL_PROCESS,
  guide: { id: "process-guide", steps: [
    { id: "observe", label: "Follow the attached tool", duration: "5s", scene: {}, note: "The host supplies progress and the accepted stamped result." },
  ] },
  render: (ctx) => renderProcess(ctx.data, ctx.width, ctx.height),
});
