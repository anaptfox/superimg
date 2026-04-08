import { tween, type EasingName } from "./tween.js";
import { kenBurns } from "./backgrounds.js";
import { css } from "./css.js";
import { clamp } from "./math.js";

export interface MontageOptions {
  images: string[];
  progress: number;
  transition?: {
    duration?: number;
    easing?: EasingName;
  };
  kenBurns?: {
    enabled?: boolean;
    zoomFrom?: number;
    zoomTo?: number;
  };
  overlay?: string;
}

export interface MontageLayer {
  index: number;
  opacity: number;
  kenBurnsProgress: number;
  imageUrl: string;
}

export interface MontageResult {
  currentIndex: number;
  layers: MontageLayer[];
  html: string;
  renderLayer: (index: number) => string;
}

export function montage(options: MontageOptions): MontageResult {
  const {
    images,
    progress: overallProgress,
    transition = {},
    kenBurns: kenBurnsOpts = {},
    overlay,
  } = options;

  const transitionDuration = transition.duration ?? 0.2;
  const transitionEasing = transition.easing ?? "easeInOutCubic";
  const kenBurnsEnabled = kenBurnsOpts.enabled ?? true;
  const zoomFrom = kenBurnsOpts.zoomFrom ?? 1.0;
  const zoomTo = kenBurnsOpts.zoomTo ?? 1.1;

  // Calculate timing
  const imageCount = images.length;
  const imageDuration = 1 / imageCount;

  // Distribute images evenly so the last one ends at progress 1.0
  // For N images: first at 0, last ends at 1, spacing = (1 - duration) / (N - 1)
  const spacing = imageCount > 1 ? (1 - imageDuration) / (imageCount - 1) : 0;

  // Find active layers
  const layers: MontageLayer[] = [];
  let currentIndex = 0;

  for (let i = 0; i < imageCount; i++) {
    const imageStart = i * spacing;
    const imageEnd = imageStart + imageDuration;

    // Skip if image not in active window
    if (overallProgress < imageStart || overallProgress > imageEnd) continue;

    const localProgress = (overallProgress - imageStart) / imageDuration;
    const kenBurnsProgress = clamp(localProgress, 0, 1);

    // Calculate opacity with crossfades
    let opacity = 1;
    if (localProgress < transitionDuration) {
      // Fading in
      opacity = tween(0, 1, localProgress / transitionDuration, transitionEasing);
    } else if (localProgress > 1 - transitionDuration) {
      // Fading out
      opacity = tween(1, 0, (localProgress - (1 - transitionDuration)) / transitionDuration, transitionEasing);
    }

    // Track current (most prominent) image
    if (opacity > 0.5) currentIndex = i;

    layers.push({
      index: i,
      opacity,
      kenBurnsProgress,
      imageUrl: images[i],
    });
  }

  // Generate HTML
  const renderLayer = (index: number) => {
    const layer = layers.find(l => l.index === index);
    if (!layer) return "";

    const bg = kenBurnsEnabled
      ? kenBurns({
          src: layer.imageUrl,
          progress: layer.kenBurnsProgress,
          zoomFrom,
          zoomTo,
          overlay,
        })
      : {
          html: `<img src="${layer.imageUrl}" style="width:100%;height:100%;object-fit:cover;" />`,
        };

    return `
      <div style="${css({
        opacity: layer.opacity,
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
      })}">
        ${bg.html}
      </div>
    `;
  };

  const html = layers.map(l => renderLayer(l.index)).join("");

  return {
    currentIndex,
    layers,
    html,
    renderLayer,
  };
}
