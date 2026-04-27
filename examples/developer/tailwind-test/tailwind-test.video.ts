import { defineScene } from "superimg";

export default defineScene({
  data: {
    title: "Tailwind v4",
    features: ["Utility-First", "Grid Layout", "Flexbox", "Gradients"],
  },

  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 8,
    tailwind: true,
  },

  render(ctx) {
    const { std, data } = ctx;
    const { title, features } = data;

    // score: intro (2s) → features (4s) → outro (2s)
    // Fractions of 8s: 0.25 / 0.5 / 0.25
    const t = std.score({ intro: 0.25, features: 0.5, outro: 0.25 });

    // Phase-specific rendering based on which is active
    if (t.active === "intro") {
      return renderIntro(std, t.within("intro"), title);
    } else if (t.active === "features") {
      return renderFeatures(std, t, features);
    } else if (t.active === "outro") {
      return renderOutro(std, t.within("outro"));
    }

    return "";
  },
});

function renderIntro(std: any, progress: number, title: string) {
  const scale = std.interpolate(progress, [0, 1], [0.8, 1], "easeOutBack");
  const opacity = std.interpolate(Math.min(progress * 2, 1), [0, 1], [0, 1], "easeOutCubic");
  const titleStyle = std.css({ transform: `scale(${scale})`, opacity });
  const subtitleOpacity = std.interpolate(
    Math.max(0, (progress - 0.3) / 0.7),
    [0, 1],
    [0, 1],
    "easeOutCubic"
  );

  return `
    <div class="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700">
      <h1 class="text-9xl font-black text-white tracking-tight drop-shadow-2xl" style="${titleStyle}">
        ${title}
      </h1>
      <p class="mt-8 text-3xl text-white/70 font-medium" style="opacity: ${subtitleOpacity}">
        Zero-config utility classes for video
      </p>
    </div>
  `;
}

function renderFeatures(std: any, t: any, features: string[]) {
  const cardHtml = features
    .map((feature, i) => {
      // Stagger cards within the features phase using t.motion
      const cardAnim = t.motion({
        during: "features",
        at: i * 0.1,
        duration: 0.4,
        y: 40,
        easing: "easeOutCubic"
      });

      const y = std.spring(40, 0, cardAnim.enter, { stiffness: 150, damping: 12 });
      const cardStyle = std.css({ transform: `translateY(${y}px)`, opacity: cardAnim.opacity });

      return `
      <div class="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 shadow-xl" style="${cardStyle}">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 mb-4 flex items-center justify-center">
          <span class="text-2xl">✨</span>
        </div>
        <h3 class="text-2xl font-bold text-white mb-2">${feature}</h3>
        <p class="text-white/60">Built-in support</p>
      </div>
    `;
    })
    .join("");

  return `
    <div class="w-full h-full bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-20">
      <h2 class="text-5xl font-bold text-white mb-12 text-center">Key Features</h2>
      <div class="grid grid-cols-4 gap-8 max-w-6xl mx-auto">
        ${cardHtml}
      </div>
    </div>
  `;
}

function renderOutro(std: any, progress: number) {
  const scale = std.interpolate(progress, [0, 1], [1, 0.9], "easeInCubic");
  const opacity = std.interpolate(progress, [0, 1], [1, 0], "easeInCubic");
  const style = std.css({ transform: `scale(${scale})`, opacity });

  return `
    <div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-600 to-cyan-600" style="${style}">
      <div class="text-center">
        <p class="text-6xl font-bold text-white">Ready to Build?</p>
        <p class="mt-4 text-2xl text-white/80">npm install superimg</p>
      </div>
    </div>
  `;
}
