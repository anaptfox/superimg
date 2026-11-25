import { Html, image } from "@foxworth/superimg";

export default image({
  size: { width: 640, height: 360 },
  // Same local key, separate bytes and source directory.
  assets: {
    logo: {
      bytes: new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="8" y="8" width="84" height="84" rx="12" fill="#22d3ee"/></svg>'),
      mimeType: "image/svg+xml",
    },
  },
  render(ctx) {
    return Html({
      html: `<div style="width:100%;height:100%;display:grid;place-items:center;gap:22px;background:#37213b;color:#fff;font:700 48px system-ui"><img src="${ctx.asset("logo")}" width="144" height="144" alt="cyan square logo"><span>second — cyan square</span></div>`,
    });
  },
});
