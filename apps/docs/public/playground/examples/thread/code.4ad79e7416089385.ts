import { define, type RenderContext } from "superimg";

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

export default define<ThreadData>({
  sample: {
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
    duration: "9s",
  },
  render(ctx: RenderContext<ThreadData>) {
    const { std, width, height, timeline, data } = ctx;
    const {
      author,
      tweets,
      theme = "dark",
      transitionStyle = "slide",
      showPosition = true,
    } = data;

    const tweetCount = tweets.length;

    const bgColor = theme === "dark" ? "#0a0a0a" : "#fafafa";
    const textColor = theme === "dark" ? "#ffffff" : "#0a0a0a";
    const mutedColor = theme === "dark" ? "#71717a" : "#a1a1aa";
    const cardBg = theme === "dark" ? "#16181c" : "#ffffff";
    const accentColor = "#1d9bf0";

    const THEME = { bg: bgColor, text: textColor, muted: mutedColor, cardBg, accent: accentColor };

    const d = ctx.director({ intro: "8%", tweets: "84%", count: "4%", outro: "4%" });
    const car = std.carousel(tweets, {
      during: d.in("tweets"),
      enter: 0.3,
      exit: 0.25,
      last: "hold",
    });

    const authorProgress = std.interpolate(d.in("intro"), [0, 1], [0, 1], "easeOutCubic");
    const finalCountProgress = std.interpolate(d.in("count"), [0, 1], [0, 1], "easeOutCubic");
    const fadeOutProgress = std.interpolate(d.in("outro"), [0, 1], [0, 1], "easeOutCubic");

    const globalOpacity = 1 - fadeOutProgress;
    const baseFontSize = Math.min(width, height) * 0.038;
    const headerHeight = height * 0.15;
    const cardPadding = width * 0.06;
    const cardWidth = width - cardPadding * 2;
    const cardHeight = height - headerHeight - cardPadding * 2.5;

    let currentTweetHtml = "";

    for (let i = 0; i < tweetCount; i++) {
      const tweet = tweets[i]!;
      const item = car.state(i);
      if (item.state === "hidden" || item.state === "gone") continue;

      const { enter, exit, state: phase } = item;

      let transform = "";
      let opacity = 1;

      if (transitionStyle === "slide") {
        if (phase === "entering") {
          transform = `translateX(${(1 - enter) * 100}%)`;
          opacity = enter;
        } else if (phase === "exiting") {
          transform = `translateX(${-exit * 100}%)`;
          opacity = 1 - exit;
        }
      } else if (transitionStyle === "stack") {
        if (phase === "entering") {
          transform = `translateY(${(1 - enter) * 30}px) scale(${0.9 + enter * 0.1})`;
          opacity = enter;
        } else if (phase === "exiting") {
          transform = `translateY(${-exit * 20}px) scale(${1 - exit * 0.05})`;
          opacity = 1 - exit * 0.8;
        }
      } else if (transitionStyle === "flip") {
        if (phase === "entering") {
          const rotateY = (1 - enter) * 90;
          transform = `perspective(1000px) rotateY(${rotateY}deg)`;
          opacity = enter;
        } else if (phase === "exiting") {
          const rotateY = exit * -90;
          transform = `perspective(1000px) rotateY(${rotateY}deg)`;
          opacity = 1 - exit;
        }
      }

      const zIndex = phase === "entering" ? 2 : 1;

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
        z-index:${zIndex};
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
