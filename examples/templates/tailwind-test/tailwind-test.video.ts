import { defineScene } from "superimg";
import { timeline } from "@superimg/stdlib/timeline";

export default defineScene({
  defaults: {
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
    const { std, sceneTimeSeconds: time, sceneDurationSeconds: duration, sceneProgress, data } = ctx;
    const { title, features } = data;

    // Timeline: intro (0-2s) → features (2-6s) → outro (6-8s)
    const tl = timeline(time, duration);
    const intro = tl.at("intro", 0, 2);
    const featuresPhase = tl.at("features", 2, 4);
    const outro = tl.at("outro", 6, 2);

    // Phase-specific rendering based on which is active
    if (intro.active || intro.progress < 1 && featuresPhase.progress === 0) {
      return renderIntro(std, intro.progress, title);
    } else if (featuresPhase.active || (featuresPhase.progress === 1 && outro.progress === 0)) {
      return renderFeatures(std, tl, featuresPhase, features);
    } else {
      return renderOutro(std, outro.progress);
    }
  },
});

function renderIntro(std: any, progress: number, title: string) {
  const scale = std.tween(0.8, 1, progress, "easeOutBack");
  const opacity = std.tween(0, 1, Math.min(progress * 2, 1), "easeOutCubic");
  const titleStyle = std.css({ transform: `scale(${scale})`, opacity });
  const subtitleOpacity = std.tween(
    0,
    1,
    Math.max(0, (progress - 0.3) / 0.7),
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

function renderFeatures(std: any, tl: any, featuresPhase: any, features: string[]) {
  // Create scoped timeline for features phase (re-zeroed to 0-4s)
  const scoped = tl.scope(featuresPhase.start, featuresPhase.end);

  // Stagger cards within the features phase
  const cardIds = features.map((_, i) => `card-${i}`);
  const cards = scoped.stagger(cardIds, {
    start: 0,
    each: 0.15,
    duration: 0.4,
  });

  const cardHtml = features
    .map((feature, i) => {
      const cardEvent = cards.get(i);
      const bounce = std.createSpring({ stiffness: 150, damping: 12 });
      const y = std.tween(40, 0, cardEvent.progress, bounce);
      const opacity = std.tween(0, 1, cardEvent.progress, "easeOutCubic");
      const cardStyle = std.css({ transform: `translateY(${y}px)`, opacity });

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
  const scale = std.tween(1, 0.9, progress, "easeInCubic");
  const opacity = std.tween(1, 0, progress, "easeInCubic");
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
