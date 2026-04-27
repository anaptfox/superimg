import { defineScene, type RenderContext } from "superimg";

export interface TweetVideoData extends Record<string, unknown> {
  text: string;
  author: { name: string; handle: string; avatar: string };
  createdAt: string;
  likes: number;
  retweets: number;
  replies: number;
  views?: number;
  media: Array<{ url: string; type: string; thumbnail_url?: string }>;
  quote?: {
    text: string;
    author: { name: string; handle: string; avatar: string };
  };
}

export default defineScene<TweetVideoData>({
  data: {
    text: "Twitter is the digital town square.",
    author: { name: "Elon Musk", handle: "elonmusk", avatar: "https://pbs.twimg.com/profile_images/1845482317545750528/o8XKEI-E_400x400.jpg" },
    createdAt: "2022-10-28T00:00:00.000Z",
    likes: 500000,
    retweets: 50000,
    replies: 100000,
    views: 150000000,
    media: [],
  },
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 5,
  },
  render(ctx: RenderContext<TweetVideoData>) {
    const { std, width, height, sceneProgress, data } = ctx;
    const { text, author, createdAt, likes, retweets, replies, views, media, quote } = data;

    const hasText = text.trim().length > 0;

    const TIMING = hasText
      ? {
          authorFadeIn: { start: 0, end: 0.1 },
          textReveal: { start: 0.1, end: 0.7 },
          imagesFadeIn: { start: 0.7, end: 0.8 },
          metricsCountUp: { start: 0.8, end: 1.0 },
        }
      : {
          authorFadeIn: { start: 0, end: 0.15 },
          textReveal: { start: 0, end: 0 },
          imagesFadeIn: { start: 0.15, end: 0.3 },
          metricsCountUp: { start: 0.85, end: 1.0 },
        };

    const authorProgress = std.interpolate(sceneProgress, [TIMING.authorFadeIn.start, TIMING.authorFadeIn.end], [0, 1], "easeOutCubic");
    const textProgress = hasText ? std.interpolate(sceneProgress, [TIMING.textReveal.start, TIMING.textReveal.end], [0, 1]) : 0;
    const imagesProgress = std.interpolate(sceneProgress, [TIMING.imagesFadeIn.start, TIMING.imagesFadeIn.end], [0, 1], "easeOutCubic");
    const metricsProgress = std.interpolate(sceneProgress, [TIMING.metricsCountUp.start, TIMING.metricsCountUp.end], [0, 1], "easeOutCubic");

    const visibleChars = hasText ? Math.floor(textProgress * text.length) : 0;
    const displayText = hasText ? text.substring(0, visibleChars) : "";
    const cursor = hasText && textProgress < 1 ? '<span style="animation: blink 0.5s infinite;">|</span>' : "";

    const displayLikes = Math.floor(metricsProgress * likes);
    const displayRetweets = Math.floor(metricsProgress * retweets);
    const displayReplies = Math.floor(metricsProgress * replies);
    const displayViews = views ? Math.floor(metricsProgress * views) : 0;

    // Format date
    const formattedDate = createdAt
      ? new Date(createdAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "";

    let mediaHtml = "";
    if (media && media.length > 0) {
      const imageHeight = hasText || quote ? "350px" : "500px";
      const marginTop = hasText ? "24px" : "0px";
      const mediaItems = media
        .map((m: { url: string; type: string; thumbnail_url?: string }) => {
          if (m.type === "photo") {
            return `<div style="flex: 1; min-width: 0; background: url('${m.url}') center/cover no-repeat; border-radius: 16px; opacity: ${imagesProgress}; transform: translateY(${(1 - imagesProgress) * 20}px);"></div>`;
          }
          if (m.type === "video" && m.thumbnail_url) {
            return `<div style="flex: 1; min-width: 0; position: relative; border-radius: 16px; overflow: hidden; opacity: ${imagesProgress}; transform: translateY(${(1 - imagesProgress) * 20}px);">
              <div style="width: 100%; height: 100%; background: url('${m.thumbnail_url}') center/cover no-repeat;"></div>
              <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;">
                <div style="width: 80px; height: 80px; background: rgba(0,0,0,0.6); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                  <div style="width: 0; height: 0; border-left: 30px solid white; border-top: 18px solid transparent; border-bottom: 18px solid transparent; margin-left: 8px;"></div>
                </div>
              </div>
            </div>`;
          }
          return "";
        })
        .join("");
      mediaHtml = `<div style="display: flex; gap: 12px; margin-top: ${marginTop}; height: ${imageHeight};">${mediaItems}</div>`;
    }

    // Quote tweet rendering
    let quoteHtml = "";
    if (quote) {
      quoteHtml = `<div style="margin-top: 20px; border: 1px solid #2f3336; border-radius: 16px; padding: 16px; opacity: ${imagesProgress}; transform: translateY(${(1 - imagesProgress) * 10}px);">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
          <img src="${quote.author.avatar}" style="width: 24px; height: 24px; border-radius: 50%;" crossorigin="anonymous" />
          <span style="font-size: 16px; font-weight: 600; color: #fff;">${quote.author.name}</span>
          <span style="font-size: 16px; color: #71767b;">@${quote.author.handle}</span>
        </div>
        <div style="font-size: 18px; line-height: 1.4; color: #fff;">${quote.text}</div>
      </div>`;
    }

    return `
    <style>@keyframes blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }</style>
    <div style="width: ${width}px; height: ${height}px; background: linear-gradient(180deg, #0f0f0f 0%, #1a1a2e 100%); display: flex; flex-direction: column; padding: 80px; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="display: flex; align-items: center; gap: 20px; opacity: ${authorProgress}; transform: translateY(${(1 - authorProgress) * -30}px);">
        <img src="${author.avatar}" style="width: 80px; height: 80px; border-radius: 50%; border: 3px solid #1d9bf0;" crossorigin="anonymous" />
        <div>
          <div style="font-size: 32px; font-weight: 700; color: #fff;">${author.name}</div>
          <div style="font-size: 24px; color: #71767b;">@${author.handle}</div>
          ${formattedDate ? `<div style="font-size: 20px; color: #71767b; margin-top: 4px;">${formattedDate}</div>` : ""}
        </div>
      </div>
      <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; margin-top: 40px;">
        ${hasText ? `<div style="font-size: 48px; line-height: 1.4; color: #fff; white-space: pre-wrap; word-wrap: break-word;">${displayText}${cursor}</div>` : ""}
        ${quoteHtml}
        ${mediaHtml}
      </div>
      <div style="display: flex; gap: 40px; padding-top: 40px; border-top: 1px solid #2f3336; opacity: ${metricsProgress};">
        <div style="display: flex; align-items: center; gap: 12px;"><svg width="32" height="32" viewBox="0 0 24 24" fill="#71767b"><path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z"/></svg><span style="font-size: 28px; color: #71767b;">${std.text.formatCompact(displayReplies)}</span></div>
        <div style="display: flex; align-items: center; gap: 12px;"><svg width="32" height="32" viewBox="0 0 24 24" fill="#00ba7c"><path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z"/></svg><span style="font-size: 28px; color: #00ba7c;">${std.text.formatCompact(displayRetweets)}</span></div>
        <div style="display: flex; align-items: center; gap: 12px;"><svg width="32" height="32" viewBox="0 0 24 24" fill="#f91880"><path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z"/></svg><span style="font-size: 28px; color: #f91880;">${std.text.formatCompact(displayLikes)}</span></div>
        ${displayViews > 0 ? `<div style="display: flex; align-items: center; gap: 12px;"><svg width="32" height="32" viewBox="0 0 24 24" fill="#71767b"><path d="M8.75 21V3h2v18h-2zM18 21V8.5h2V21h-2zM4 21l.004-10h2L6 21H4zm9.248 0v-7h2v7h-2z"/></svg><span style="font-size: 28px; color: #71767b;">${std.text.formatCompact(displayViews)}</span></div>` : ""}
      </div>
    </div>
  `;
  },
});
