//! Seek embedded video elements before frame capture.

export const VIDEO_SYNC_ATTR = "data-superimg-video";

/** ~1 frame budget when media is warm in cache. */
export function seekTimeoutMs(fps: number, warm = false): number {
  const frameMs = Math.ceil(1000 / Math.max(fps, 1));
  return warm ? frameMs + 16 : Math.max(frameMs * 3, 120);
}

export function loadTimeoutMs(): number {
  return 3000;
}

/** Install persistent helpers once per page (called from renderer init). */
export const VIDEO_SYNC_INIT_SCRIPT = `
window.__superimgWaitFor = async function(target, event, timeout) {
  if (event === "loadedmetadata" && target.readyState >= 1) return;
  if (event === "loadeddata" && target.readyState >= 2) return;
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      target.removeEventListener(event, onEvent);
      resolve();
    }, timeout);
    const onEvent = () => {
      clearTimeout(timer);
      target.removeEventListener(event, onEvent);
      resolve();
    };
    target.addEventListener(event, onEvent);
  });
};

window.__superimgSeekTo = async function(video, time, timeout) {
  if (Math.abs(video.currentTime - time) < 1e-4 && video.readyState >= 2) return;
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      video.removeEventListener("seeked", onSeeked);
      resolve();
    }, timeout);
    const onSeeked = () => {
      clearTimeout(timer);
      video.removeEventListener("seeked", onSeeked);
      resolve();
    };
    video.addEventListener("seeked", onSeeked);
    try {
      video.currentTime = time;
    } catch {
      clearTimeout(timer);
      video.removeEventListener("seeked", onSeeked);
      resolve();
    }
  });
};

window.__superimgWarmCache = function() {
  if (!window.__superimgVideoWarm) {
    window.__superimgVideoWarm = new Map();
  }
  return window.__superimgVideoWarm;
};

window.__superimgEnsureWarm = async function(src, loadTimeout) {
  const cache = window.__superimgWarmCache();
  let warm = cache.get(src);
  if (warm && warm.readyState >= 1) return warm;

  if (!warm) {
    warm = document.createElement("video");
    warm.style.cssText = "position:fixed;width:0;height:0;opacity:0;pointer-events:none";
    warm.muted = true;
    warm.playsInline = true;
    warm.preload = "auto";
    warm.crossOrigin = "anonymous";
    document.body.appendChild(warm);
    cache.set(src, warm);
  }

  if (warm.src !== src) {
    warm.src = src;
    warm.load();
  }

  await window.__superimgWaitFor(warm, "loadedmetadata", loadTimeout);
  return warm;
};
`;

export async function installVideoSyncHelpers(
  page: { evaluate: (fn: (script: string) => void, script: string) => Promise<void> },
): Promise<void> {
  await page.evaluate((script) => {
    new Function(script)();
  }, VIDEO_SYNC_INIT_SCRIPT);
}

export async function warmVideosInPage(
  page: { evaluate: (fn: (...args: unknown[]) => Promise<void>, arg: unknown) => Promise<void> },
  urls: string[],
): Promise<void> {
  if (urls.length === 0) return;
  await page.evaluate(
    async ({ sources, loadTimeout }) => {
      await Promise.all(
        sources.map((src) => window.__superimgEnsureWarm(src, loadTimeout)),
      );
    },
    { sources: urls, loadTimeout: loadTimeoutMs() },
  );
}

export async function syncVideosInPage(
  page: { evaluate: (fn: (...args: unknown[]) => Promise<void>, arg: unknown) => Promise<void> },
  fps: number,
): Promise<void> {
  const warmSeek = seekTimeoutMs(fps, true);
  const coldSeek = seekTimeoutMs(fps, false);
  const loadMs = loadTimeoutMs();

  await page.evaluate(
    async ({ attr, warmSeek, coldSeek, loadTimeout }) => {
      const primed = window.__superimgPrimedSources ??= new Set();
      const warmCache = window.__superimgWarmCache();
      const videos = Array.from(
        document.querySelectorAll(`[${attr}]`),
      );

      await Promise.all(
        videos.map(async (video) => {
          const src = video.getAttribute("data-src") || video.src;
          const at = parseFloat(video.getAttribute("data-at") ?? "0");
          if (!src || !Number.isFinite(at)) return;

          video.crossOrigin = video.crossOrigin || "anonymous";
          video.muted = true;
          video.playsInline = true;
          video.preload = "auto";

          if (!primed.has(src)) {
            await window.__superimgEnsureWarm(src, loadTimeout);
            primed.add(src);
          }

          const warm = warmCache.get(src);
          if (video.src !== src) {
            video.src = src;
          }

          const duration = Number.isFinite(video.duration)
            ? video.duration
            : warm && Number.isFinite(warm.duration)
              ? warm.duration
              : 0;
          const target =
            duration > 0
              ? Math.min(Math.max(0, at), Math.max(0, duration - 1 / 30))
              : Math.max(0, at);

          await window.__superimgSeekTo(
            video,
            target,
            primed.has(src) ? warmSeek : coldSeek,
          );
        }),
      );
    },
    { attr: VIDEO_SYNC_ATTR, warmSeek, coldSeek, loadTimeout: loadMs },
  );
}