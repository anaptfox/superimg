/** Keep in sync with `THREE_VERSION` / `THREE_MODULE` in @superimg/stdlib viz/three.ts */
export const THREE_VERSION = "0.184.0";
export const THREE_MODULE = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.min.js`;

export async function preloadThreeModule(
  page: { evaluate: (fn: (url: string) => Promise<void>, url: string) => Promise<void> },
): Promise<void> {
  await page.evaluate(async (url) => {
    const w = window as Window & { __SUPERIMG_THREE__?: Record<string, unknown> };
    if (!w.__SUPERIMG_THREE__) {
      w.__SUPERIMG_THREE__ = await import(url);
    }
  }, THREE_MODULE);
}