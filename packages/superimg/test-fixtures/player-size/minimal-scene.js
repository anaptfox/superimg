export default {
  kind: "media",
  media: "video",
  fallbackFormat: "mp4",
  medium: "html",
  animated: true,
  mediaCapabilities: { version: 0, names: [] },
  config: { width: 640, height: 360, fps: 30, duration: 1 },
  render(ctx) {
    return {
      $$typeof: "@foxworth/superimg/element",
      type: "Frame",
      props: { width: ctx.width, height: ctx.height, fill: "#111827" },
      children: [
        {
          $$typeof: "@foxworth/superimg/element",
          type: "Text",
          props: { color: "#f9fafb", fontSize: 42 },
          children: ["Hello"],
        },
      ],
    };
  },
};
