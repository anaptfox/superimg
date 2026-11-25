import { image } from "@foxworth/superimg";
import { MATERIAL_FONTS } from "../_material/resources";
import { INITIAL_CLEFT, sampleCleft, type CleftInput } from "./model";
import { renderCleft } from "./paint";

export default image<CleftInput>({
  size: { width: 2160, height: 2160 }, fonts: MATERIAL_FONTS,
  sample: { ...INITIAL_CLEFT, live: false },
  render(ctx) {
    return renderCleft(sampleCleft(ctx.data, { kind: "poster", seconds: 0 }), {
      width: ctx.width, height: ctx.height, draw: ctx.std.svg.draw,
    });
  },
});
