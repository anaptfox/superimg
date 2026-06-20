let uid = 0;

export function canvas(opts: {
  width: number;
  height: number;
  draw: string;
  style?: string;
}): string {
  const { width, height, draw, style = "" } = opts;
  const id = `c-${uid++}`;
  return `<canvas id="${id}" width="${width}" height="${height}" style="${style}"></canvas>
<script>
(function(){
  var canvas = document.getElementById("${id}");
  var ctx = canvas.getContext("2d");
  ${draw}
})();
</script>`;
}
