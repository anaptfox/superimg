import { define, Html } from "@foxworth/superimg";

export default define({
  config: { width: 1280, height: 720 },
  render() {
    return Html({ id: "question", width: "fill", height: "fill", html: `<main style="width:100%;height:100%;display:grid;place-items:center;background:#142328;color:#f2eee5;font:700 62px/1.15 system-ui;text-align:center"><div>WHY DOES THE SHADOW<br><span style="color:#f2b35f">MOVE BEFORE THE SUN?</span><small style="display:block;margin-top:28px;font-size:20px;letter-spacing:.18em;color:#9aafa9">CHOOSE YOUR EXPLANATION</small></div></main>` });
  },
});
