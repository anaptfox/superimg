import { define, Html } from "@foxworth/superimg";

export default define({
  config: { width: 1280, height: 720 },
  render() {
    return Html({ id: "closing", width: "fill", height: "fill", html: `<main style="width:100%;height:100%;display:grid;place-items:center;background:#f2b35f;color:#142328;font:700 68px system-ui"><div>ONE QUESTION.<br>TWO WAYS IN.</div></main>` });
  },
});
