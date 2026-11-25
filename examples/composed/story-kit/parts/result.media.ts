import { define, Html } from "@foxworth/superimg";

export default define({
  config: { width: 1200, height: 675 },
  render() {
    return Html({ id: "result", width: "fill", height: "fill", html: `<main style="width:100%;height:100%;background:#f4f1ea;color:#101820;display:grid;place-items:center;font:700 72px system-ui"><div>RESULT<br><span style="font-size:30px;color:#287965">THE SIGNAL ARRIVES</span></div></main>` });
  },
});
