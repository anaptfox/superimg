/**
 * Still-page reuse helpers. Extracted so init-failure release is unit-testable
 * without launching Chromium.
 */

export function stillPageKey(width: number, height: number, dpr: number): string {
  return `${width}x${height}@${dpr}`;
}

export function chooseStillRendererKind(
  poolStillPages: boolean | undefined,
): "pooled" | "fresh" {
  return poolStillPages === true ? "pooled" : "fresh";
}

/**
 * Acquire a pooled page, bind a renderer, and release the page if init throws
 * so it cannot leak into `stillInUse`.
 */
export async function bindPooledStillPage<TPage, TInner>(options: {
  acquire: () => Promise<TPage>;
  release: (page: TPage) => void;
  bind: (page: TPage) => TInner;
  init: (inner: TInner) => Promise<void>;
}): Promise<{ page: TPage; inner: TInner }> {
  const page = await options.acquire();
  try {
    const inner = options.bind(page);
    await options.init(inner);
    return { page, inner };
  } catch (error) {
    options.release(page);
    throw error;
  }
}
