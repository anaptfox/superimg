/**
 * Capture readiness helpers — pure string builders for Playwright export.
 *
 * Happy path needs no API (fonts + images auto-wait). Use these for custom
 * canvas/WebGL when you leave pure HTML. Prefer `token()` so attr + done match.
 *
 * Implementation uses `window.__superimgReady` in the page shell — do not teach
 * that global as the author API; use these snippets instead.
 */

export const WAIT_ATTR = "data-superimg-wait";

/** Stable alias used in generated scripts (shell also exposes window.__superimgReady). */
const READY_GLOBAL = "window.__superimgReady";

export interface ReadyToken {
  /** Unique label for this wait */
  label: string;
  /** HTML attribute fragment: `data-superimg-wait="…"` */
  attr: string;
  /** JS expression/statement to mark ready (for inline scripts) */
  done: string;
  /** JS statement to mark failed */
  fail: (err: string) => string;
}

function escapeJsString(s: string): string {
  return JSON.stringify(s);
}

/**
 * Create a matched wait token — use `.attr` on the element and `.done` after paint.
 *
 * @example
 * const w = std.ready.token("particles");
 * return `<canvas ${w.attr} id="c"></canvas>
 * <script>
 *   // … draw …
 *   ${w.done}
 * </script>`;
 */
export function token(label: string): ReadyToken {
  const id = label.trim();
  if (!id) {
    throw new Error('std.ready.token(label): label must be a non-empty string');
  }
  return {
    label: id,
    attr: `${WAIT_ATTR}=${escapeJsString(id)}`,
    done: `${READY_GLOBAL}&&${READY_GLOBAL}.done(${escapeJsString(id)});`,
    fail: (err: string) =>
      `${READY_GLOBAL}&&${READY_GLOBAL}.fail(${escapeJsString(id)},${escapeJsString(err)});`,
  };
}

/** Inline JS: mark a label ready after paint. Prefer `token(label).done` when possible. */
export function done(label: string): string {
  return token(label).done;
}

/** Inline JS: mark a label failed. Prefer `token(label).fail(err)`. */
export function fail(label: string, err: string): string {
  return token(label).fail(err);
}

export const ready = {
  token,
  done,
  fail,
  WAIT_ATTR,
};

export default ready;
