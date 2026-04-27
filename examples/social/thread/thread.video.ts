import { defineScene, type RenderContext } from "superimg";

export type TransitionStyle = "slide" | "stack" | "flip";

export interface ThreadTweet {
  id: string;
  text: string;
  position: number;
}

export interface ThreadAuthor {
  name: string;
  handle: string;
  avatar?: string;
}

export interface ThreadData extends Record<string, unknown> {
  author: ThreadAuthor;
  tweets: ThreadTweet[];
  theme?: "light" | "dark";
  transitionStyle?: TransitionStyle;
  showPosition?: boolean;
}

export default defineScene<ThreadData>({
  data: {
    author: {
      name: "Thread Master",
      handle: "threadmaster",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=thread",
    },
    tweets: [
      { id: "1", text: "Here's why every dev should learn video marketing (thread):", position: 1 },
      { id: "2", text: "1. Video gets 10x more engagement than text", position: 2 },
      { id: "3", text: "2. It builds trust faster than blog posts", position: 3 },
    ],
    theme: "dark",
    transitionStyle: "slide",
    showPosition: true,
  },
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 9,
  },
  render(ctx: RenderContext<ThreadData>) {
    const { std, width, height, sceneProgress, data } = ctx;
    const {
      author,
      tweets,
      theme = "dark",
      transitionStyle = "slide",
      showPosition = true,
    } = data;

    const tweetCount = tweets.length;
    const tweetDuration = tweetCount > 0 ? 0.85 / tweetCount : 0.2;

    const bgColor = theme === "dark" ? "#0a0a0a" : "#fafafa";
    const textColor = theme === "dark" ? "#ffffff" : "#0a0a0a";
    const mutedColor = theme === "dark" ? "#71717a" : "#a1a1aa";
    const cardBg = theme === "dark" ? "#16181c" : "#ffffff";
    const accentColor = "#1d9bf0";

    const THEME = { bg: bgColor, text: textColor, muted: mutedColor, cardBg, accent: accentColor };

    const TIMING = {
      authorIntro: { start: 0, end: 0.08 },
      tweetsPhase: { start: 0.1, end: 0.92 },
      finalCount: { start: 0.92, end: 0.96 },
      fadeOut: { start: 0.96, end: 1.0 },
    };

    function getTweetVisibility(
      tweetIndex: number,
      progress: number
    ): { state: string; sceneProgress: number } {
      const tweetStart = TIMING.tweetsPhase.start + tweetIndex * tweetDuration;
      const tweetEnd = tweetStart + tweetDuration;

      if (progress >= tweetStart && progress < tweetStart + tweetDuration * 0.2) {
        const enterProgress = (progress - tweetStart) / (tweetDuration * 0.2);
        return { state: "entering", sceneProgress: std.interpolate(enterProgress, [0, 1], [0, 1], "easeOutBack") };
      }

      if (progress >= tweetStart + tweetDuration * 0.2 && progress < tweetEnd - tweetDuration * 0.15) {
        return { state: "visible", sceneProgress: 1 };
      }

      if (tweetIndex < tweetCount - 1 && progress >= tweetEnd - tweetDuration * 0.15 && progress < tweetEnd) {
        const exitProgress = (progress - (tweetEnd - tweetDuration * 0.15)) / (tweetDuration * 0.15);
        return { state: "exiting", sceneProgress: std.interpolate(exitProgress, [0, 1], [0, 1], "easeInOutCubic") };
      }

      if (tweetIndex === tweetCount - 1 && progress >= tweetStart) {
        return { state: "visible", sceneProgress: 1 };
      }

      if (progress < tweetStart) {
        return { state: "hidden", sceneProgress: 0 };
      }

      return { state: "exited", sceneProgress: 1 };
    }

    const authorProgress = std.interpolate(sceneProgress, [TIMING.authorIntro.start, TIMING.authorIntro.end], [0, 1], "easeOutCubic");
    const finalCountProgress = std.interpolate(sceneProgress, [TIMING.finalCount.start, TIMING.finalCount.end], [0, 1], "easeOutCubic");
    const fadeOutProgress = std.interpolate(sceneProgress, [TIMING.fadeOut.start, TIMING.fadeOut.end], [0, 1], "easeOutCubic");

    const globalOpacity = 1 - fadeOutProgress;
    const baseFontSize = Math.min(width, height) * 0.038;
    const headerHeight = height * 0.15;
    const cardPadding = width * 0.06;
    const cardWidth = width - cardPadding * 2;
    const cardHeight = height - headerHeight - cardPadding * 2.5;

    let currentTweetHtml = "";

    for (let i = 0; i < tweetCount; i++) {
      const tweet = tweets[i]!;
      const vis = getTweetVisibility(i, sceneProgress);

      if (vis.state === "hidden" || vis.state === "exited") continue;

      let transform = "";
      let opacity = 1;

      if (transitionStyle === "slide") {
        if (vis.state === "entering") {
          transform = `translateX(${(1 - vis.sceneProgress) * 100}%)`;
          opacity = vis.sceneProgress;
        } else if (vis.state === "exiting") {
          transform = `translateX(${-vis.sceneProgress * 100}%)`;
          opacity = 1 - vis.sceneProgress;
        }
      } else if (transitionStyle === "stack") {
        if (vis.state === "entering") {
          transform = `translateY(${(1 - vis.sceneProgress) * 30}px) scale(${0.9 + vis.sceneProgress * 0.1})`;
          opacity = vis.sceneProgress;
        } else if (vis.state === "exiting") {
          transform = `translateY(${-vis.sceneProgress * 20}px) scale(${1 - vis.sceneProgress * 0.05})`;
          opacity = 1 - vis.sceneProgress * 0.8;
        }
      } else if (transitionStyle === "flip") {
        if (vis.state === "entering") {
          const rotateY = (1 - vis.sceneProgress) * 90;
          transform = `perspective(1000px) rotateY(${rotateY}deg)`;
          opacity = vis.sceneProgress;
        } else if (vis.state === "exiting") {
          const rotateY = vis.sceneProgress * -90;
          transform = `perspective(1000px) rotateY(${rotateY}deg)`;
          opacity = 1 - vis.sceneProgress;
        }
      }

      currentTweetHtml += `
      <div style="
        position:absolute;
        left:${cardPadding}px;
        top:${headerHeight + cardPadding * 0.5}px;
        width:${cardWidth}px;
        height:${cardHeight}px;
        background:${THEME.cardBg};
        border-radius:${baseFontSize * 0.8}px;
        padding:${baseFontSize * 1.2}px;
        box-shadow:0 4px 20px rgba(0,0,0,0.15);
        transform:${transform};
        opacity:${opacity};
        display:flex;
        flex-direction:column;
        box-sizing:border-box;
      ">
        <div style="display:flex;align-items:center;gap:${baseFontSize * 0.6}px;margin-bottom:${baseFontSize * 0.8}px;">
          ${author.avatar ? `
            <img src="${author.avatar}" style="width:${baseFontSize * 2}px;height:${baseFontSize * 2}px;border-radius:50%;object-fit:cover;" />
          ` : `
            <div style="width:${baseFontSize * 2}px;height:${baseFontSize * 2}px;border-radius:50%;background:${THEME.accent};display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:${baseFontSize * 0.9}px;">
              ${author.name.charAt(0).toUpperCase()}
            </div>
          `}
          <div>
            <div style="font-size:${baseFontSize * 0.85}px;font-weight:700;color:${THEME.text};">${author.name}</div>
            <div style="font-size:${baseFontSize * 0.7}px;color:${THEME.muted};">@${author.handle}</div>
          </div>
          ${showPosition ? `
            <div style="margin-left:auto;font-size:${baseFontSize * 0.7}px;color:${THEME.accent};font-weight:600;">
              ${tweet.position}/${tweetCount}
            </div>
          ` : ""}
        </div>

        <div style="
          flex:1;
          font-size:${baseFontSize * 1.1}px;
          color:${THEME.text};
          line-height:1.5;
          overflow:hidden;
          display:-webkit-box;
          -webkit-line-clamp:8;
          -webkit-box-orient:vertical;
        ">${tweet.text}</div>

        <div style="
          display:flex;
          align-items:center;
          gap:${baseFontSize * 0.3}px;
          margin-top:${baseFontSize * 0.6}px;
          padding-top:${baseFontSize * 0.6}px;
          border-top:1px solid ${THEME.muted}30;
          color:${THEME.accent};
          font-size:${baseFontSize * 0.65}px;
          font-weight:500;
        ">
          <svg width="${baseFontSize * 0.8}" height="${baseFontSize * 0.8}" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-2h2v2zm0-4h-2V7h2v6zm4 4h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          Thread
        </div>
      </div>
    `;
    }

    const showFinalCount = finalCountProgress > 0 && tweetCount > 1;

    return `
    <div style="width:${width}px;height:${height}px;background:${THEME.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;position:relative;overflow:hidden;opacity:${globalOpacity};">

      <div style="
        position:absolute;
        top:0;
        left:0;
        right:0;
        height:${headerHeight}px;
        display:flex;
        align-items:center;
        justify-content:center;
        gap:${baseFontSize * 0.8}px;
        opacity:${authorProgress};
        transform:translateY(${(1 - authorProgress) * -15}px);
      ">
        ${author.avatar ? `
          <img src="${author.avatar}" style="width:${baseFontSize * 2.5}px;height:${baseFontSize * 2.5}px;border-radius:50%;object-fit:cover;border:2px solid ${THEME.accent};" />
        ` : `
          <div style="width:${baseFontSize * 2.5}px;height:${baseFontSize * 2.5}px;border-radius:50%;background:${THEME.accent};display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:${baseFontSize * 1.2}px;border:2px solid ${THEME.accent};">
            ${author.name.charAt(0).toUpperCase()}
          </div>
        `}
        <div>
          <div style="font-size:${baseFontSize * 1}px;font-weight:700;color:${THEME.text};">${author.name}</div>
          <div style="font-size:${baseFontSize * 0.75}px;color:${THEME.accent};">🧵 Thread</div>
        </div>
      </div>

      ${currentTweetHtml}

      ${showFinalCount ? `
        <div style="
          position:absolute;
          bottom:${cardPadding}px;
          left:50%;
          transform:translateX(-50%);
          font-size:${baseFontSize * 0.8}px;
          color:${THEME.muted};
          opacity:${finalCountProgress};
        ">
          ${tweetCount} tweets
        </div>
      ` : ""}

    </div>
  `;
  },
});
