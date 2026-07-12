/** Keep in sync with LOTTIE_VERSION / LOTTIE_MODULE_* in @superimg/stdlib viz/lottie.ts */
export const LOTTIE_VERSION = "5.13.0";
export const LOTTIE_MODULE_LIGHT =
  `https://cdn.jsdelivr.net/npm/lottie-web@${LOTTIE_VERSION}/build/player/lottie_light.min.js`;
export const LOTTIE_MODULE_FULL =
  `https://cdn.jsdelivr.net/npm/lottie-web@${LOTTIE_VERSION}/build/player/lottie.min.js`;

/**
 * Load lottie-web UMD once onto window.lottie (like three preload).
 * Avoids per-frame CDN races when templates inject the player script.
 */
export async function preloadLottieModule(
  page: {
    evaluate: (fn: (url: string) => Promise<void>, url: string) => Promise<void>;
  },
  full = false,
): Promise<void> {
  const url = full ? LOTTIE_MODULE_FULL : LOTTIE_MODULE_LIGHT;
  await page.evaluate(async (src) => {
    const w = window as Window & { lottie?: unknown };
    if (w.lottie) return;
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error(`Failed to load lottie: ${src}`));
      document.head.appendChild(s);
    });
  }, url);
}
