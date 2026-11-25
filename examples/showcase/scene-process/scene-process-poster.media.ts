import { image } from "@foxworth/superimg";
import { INITIAL_PROCESS, type ProcessData } from "./model";
import { renderProcess } from "./scene";

export default image<ProcessData>({
  size: { width: 640, height: 360 }, sample: INITIAL_PROCESS,
  render: (ctx) => renderProcess(ctx.data, ctx.width, ctx.height),
});
