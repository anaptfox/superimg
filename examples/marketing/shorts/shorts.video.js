import { defineScene } from "superimg";

export default defineScene({
  data: {
    title: "Shorts",
    subtitle: "Built with SuperImg",
  },

  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 5,
    tailwind: true,
  },

  render(ctx) {
    const { std, data } = ctx;

    const t = std.score();
    const titleAnim = t.motion({ scale: 0.9, exit: false });
    const subtitleAnim = t.motion({ at: 0.3, exit: false, fromOpacity: 0 });

    return `
      <div class="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <h1 class="text-8xl font-bold text-white tracking-tight" style="${titleAnim.style}">
          ${data.title}
        </h1>
        <p class="mt-6 text-2xl text-white/70 font-medium" style="opacity: ${0.7 * subtitleAnim.opacity}">
          ${data.subtitle}
        </p>
      </div>
    `;
  },
});
