/**
 * Opt-in runtime diagnostics for the SuperImg web player.
 *
 * Enable from the browser console (either works):
 *   localStorage.setItem("superimg:debug", "1")   // persists across reloads
 *   globalThis.__SUPERIMG_DEBUG__ = true           // set before the player loads
 *
 * Then reload. Logs go to `console.info` with a `[superimg]` prefix and trace the
 * font/style injection path through the iframe boundary — the place runtime issues
 * (missing fonts, lost styles, srcdoc races) actually surface.
 */
export function superimgDebugEnabled(): boolean {
  try {
    if ((globalThis as Record<string, unknown>).__SUPERIMG_DEBUG__ === true) return true;
    return typeof localStorage !== "undefined" && localStorage.getItem("superimg:debug") === "1";
  } catch {
    return false;
  }
}

export function superimgDebug(message: string, data?: unknown): void {
  if (!superimgDebugEnabled()) return;
  if (data === undefined) console.info(`[superimg] ${message}`);
  else console.info(`[superimg] ${message}`, data);
}
