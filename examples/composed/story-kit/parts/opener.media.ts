import { define, Html } from "@foxworth/superimg";

export default define({
  config: { width: 1200, height: 675 },
  render() {
    return Html({ id: "opener", width: "fill", height: "fill", html: `<main style="width:100%;height:100%;background:#101820;color:#f4f1ea;display:grid;place-items:center;font:700 68px/1.1 system-ui"><div>THE SMALL SIGNAL<br><span style="color:#78c9b0">A STORY IN THREE PARTS</span></div></main>` });
  },
});
