import { token as readyToken } from "../ready.js";

export function canvas(opts: {
  width: number;
  height: number;
  draw: string;
  style?: string;
  /**
   * Capture wait label. Default: size-derived stable id.
   * Set `wait: false` to skip readiness gating.
   */
  wait?: string | false;
}): string {
  const { width, height, draw, style = "" } = opts;
  const waitOff = opts.wait === false;
  const label =
    typeof opts.wait === "string" && opts.wait.trim()
      ? opts.wait.trim()
      : `canvas-${width}x${height}`;
  const w = waitOff ? null : readyToken(label);
  const id = waitOff
    ? `c-${width}x${height}`
    : label.replace(/[^a-zA-Z0-9_-]/g, "_");
  const attr = w ? ` ${w.attr}` : "";
  const doneLine = w ? w.done : "";
  const failLine = w ? w.fail("canvas draw failed") : "";

  return `<canvas id="${id}"${attr} width="${width}" height="${height}" style="${style}"></canvas>
<script>
(function(){
  try {
    var canvas = document.getElementById(${JSON.stringify(id)});
    if (!canvas) { ${failLine} return; }
    var ctx = canvas.getContext("2d");
    ${draw}
    ${doneLine}
  } catch (e) {
    ${failLine}
    throw e;
  }
})();
</script>`;
}
