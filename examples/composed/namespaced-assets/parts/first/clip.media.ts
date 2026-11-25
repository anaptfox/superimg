import { Html, image } from "@foxworth/superimg";

export default image({
  size: { width: 640, height: 360 },
  // This local key intentionally also appears in the second child.
  assets: {
    logo: {
      bytes: new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill="#ef4444"/></svg>'),
      mimeType: "image/svg+xml",
    },
  },
  render(ctx) {
    return Html({
      html: `<div style="width:100%;height:100%;display:grid;place-items:center;gap:22px;background:#18223a;color:#fff;font:700 48px system-ui"><img src="${ctx.asset("logo")}" width="144" height="144" alt="red circle logo"><span>first — red circle</span></div>`,
    });
  },
});
