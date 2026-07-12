import { define, layoutTimeline, type RenderContext } from "superimg";

export interface ClaudeMessage {
  id: string;
  text: string;
  role: "user" | "assistant";
}

export interface ClaudeData extends Record<string, unknown> {
  messages: ClaudeMessage[];
  model: "claude-4-opus" | "claude-4-sonnet" | "claude-3.5-sonnet";
  theme: "dark" | "light";
  timingPreset: "rapid" | "natural" | "dramatic";
  showHeader: boolean;
  showThinkingIndicator: boolean;
}

function messageWeight(text: string): number {
  return Math.max(1.2, text.length / 45);
}

function estimateChatTimeline(data: ClaudeData) {
  const pace =
    data.timingPreset === "rapid" ? 0.85 : data.timingPreset === "dramatic" ? 1.25 : 1;
  const weights = data.messages.map((m) => messageWeight(m.text));
  const messagesS = Math.max(2, weights.reduce((a, w) => a + w, 0) * 1.55 * pace);
  const holdS = Math.max(0.55, messagesS * (1 / 9));
  return layoutTimeline({ messages: messagesS, hold: holdS });
}

export default define<ClaudeData>({
  sample: {
    messages: [
      { id: "1", text: "What's the best way to learn programming?", role: "user" },
      { id: "2", text: "Start with a project you care about. The motivation to build something real will carry you through the frustrating parts.", role: "assistant" },
    ],
    model: "claude-4-sonnet",
    theme: "light",
    timingPreset: "natural",
    showHeader: true,
    showThinkingIndicator: true,
  },
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: "8s", // AST fallback; resolve() overrides
  },
  resolve({ data }) {
    const { totalSeconds, phases } = estimateChatTimeline(data);
    return { duration: `${totalSeconds}s`, phases };
  },
  render(ctx: RenderContext<ClaudeData>) {
    const { std, width, height, data } = ctx;
    const {
      messages,
      model,
      theme,
      timingPreset,
      showHeader,
      showThinkingIndicator,
    } = data;

    const msgCount = messages.length;
    const seqEnter = timingPreset === "rapid" ? 0.25 : timingPreset === "dramatic" ? 0.45 : 0.35;
    const { phases } = estimateChatTimeline(data);
    const t = ctx.director(phases);
    const weights = messages.map((m) => messageWeight(m.text));
    const stk = std.stack(messages, {
      during: t.in("messages"),
      lead: 0.05,
      trail: 0.05,
      enter: seqEnter,
      weights,
    });

    // Claude colors
    const THEME = theme === "dark" ? {
      bg: "#1a1a1a",
      userBg: "#2d2d2d",
      assistantBg: "transparent",
      text: "#f5f5f5",
      mutedText: "#a0a0a0",
      accent: "#D97757",
      border: "#3d3d3d",
      headerBg: "#1a1a1a",
      inputBg: "#2d2d2d",
    } : {
      bg: "#FAF9F5",
      userBg: "#F0EDE6",
      assistantBg: "transparent",
      text: "#1a1a1a",
      mutedText: "#6b6b6b",
      accent: "#D97757",
      border: "#E5E2DB",
      headerBg: "#FAF9F5",
      inputBg: "#F0EDE6",
    };

    const baseFontSize = Math.min(width, height) * 0.03;
    const headerHeight = showHeader ? height * 0.08 : 0;
    const footerHeight = height * 0.1;
    const contentPadding = width * 0.06;
    const maxContentWidth = Math.min(width * 0.85, 680);

    const logoSize = baseFontSize * 1.4;
    const claudeLogo = `
      <div style="
        width:${logoSize}px;
        height:${logoSize}px;
        background:${THEME.accent};
        border-radius:${logoSize * 0.3}px;
        display:flex;
        align-items:center;
        justify-content:center;
        flex-shrink:0;
      ">
        <svg width="${logoSize * 0.6}" height="${logoSize * 0.6}" viewBox="0 0 24 24" fill="white">
          <path t="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
        </svg>
      </div>
    `;

    function renderThinkingIndicator(progress: number): string {
      const shimmerPos = (progress * 200) % 100;

      return `
        <div style="
          display:flex;
          align-items:center;
          gap:${baseFontSize * 0.6}px;
          padding:${baseFontSize * 0.5}px 0;
        ">
          ${claudeLogo}
          <div style="
            width:${baseFontSize * 6}px;
            height:${baseFontSize * 0.3}px;
            background:linear-gradient(90deg, ${THEME.border} 0%, ${THEME.accent} ${shimmerPos}%, ${THEME.border} 100%);
            border-radius:${baseFontSize * 0.15}px;
          "></div>
        </div>
      `;
    }

    let messagesHtml = "";
    let currentThinkingHtml = "";

    for (let i = 0; i < msgCount; i++) {
      const msg = messages[i]!;
      const item = stk.state(i);
      if (item.state === "hidden") continue;

      const isAssistant = msg.role === "assistant";

      if (isAssistant) {
        if (showThinkingIndicator && item.state === "entering" && item.slot < 0.5) {
          currentThinkingHtml = renderThinkingIndicator(item.slot * 2);
          continue;
        }

        const typeP = item.state === "revealed"
          ? 1
          : item.state === "entering"
            ? std.interpolate(item.slot, [0.5, 1], [0, 1])
            : 0;
        if (typeP <= 0) continue;

        const { visible: displayText, typing } = std.text.type(msg.text, typeP);
        const showCursor = typing && item.state === "entering";
        const cursorHtml = showCursor ? `<span style="
          display:inline-block;
          width:2px;
          height:1.1em;
          background:${THEME.accent};
          margin-left:2px;
          vertical-align:text-bottom;
          animation:blink 0.5s infinite;
        "></span>` : "";

        const opacity = item.state === "entering" ? item.enter : 1;

        messagesHtml += `
          <div style="
            display:flex;
            align-items:flex-start;
            gap:${baseFontSize * 0.6}px;
            padding:${baseFontSize * 0.8}px 0;
            opacity:${opacity};
          ">
            ${claudeLogo}
            <div style="
              flex:1;
              font-size:${baseFontSize}px;
              line-height:1.6;
              color:${THEME.text};
              white-space:pre-wrap;
              word-wrap:break-word;
            ">${displayText}${cursorHtml}</div>
          </div>
        `;
      } else {
        const opacity = item.enter;
        const translateY = item.state === "entering"
          ? std.interpolate(item.enter, [0, 1], [10, 0], "easeOutCubic")
          : 0;

        messagesHtml += `
          <div style="
            display:flex;
            justify-content:flex-end;
            padding:${baseFontSize * 0.5}px 0;
            opacity:${opacity};
            transform:translateY(${translateY}px);
          ">
            <div style="
              max-width:80%;
              background:${THEME.userBg};
              padding:${baseFontSize * 0.7}px ${baseFontSize}px;
              border-radius:${baseFontSize * 1.2}px;
              font-size:${baseFontSize}px;
              line-height:1.5;
              color:${THEME.text};
              word-wrap:break-word;
            ">${msg.text}</div>
          </div>
        `;
      }
    }

    const modelDisplay = model === "claude-4-opus" ? "Claude 4 Opus" :
                         model === "claude-4-sonnet" ? "Claude 4 Sonnet" :
                         "Claude 3.5 Sonnet";

    const headerHtml = showHeader ? `
      <div style="
        height:${headerHeight}px;
        background:${THEME.headerBg};
        display:flex;
        align-items:center;
        justify-content:space-between;
        padding:0 ${contentPadding}px;
        border-bottom:1px solid ${THEME.border};
      ">
        <div style="
          display:flex;
          align-items:center;
          gap:${baseFontSize * 0.5}px;
          font-size:${baseFontSize * 1.1}px;
          font-weight:600;
          color:${THEME.text};
        ">
          ${claudeLogo}
          <span>Claude</span>
        </div>
        <div style="
          display:flex;
          align-items:center;
          gap:${baseFontSize * 0.3}px;
          font-size:${baseFontSize * 0.8}px;
          color:${THEME.mutedText};
          background:${THEME.userBg};
          padding:${baseFontSize * 0.3}px ${baseFontSize * 0.6}px;
          border-radius:${baseFontSize * 0.5}px;
        ">
          <span>${modelDisplay}</span>
          <span style="font-size:${baseFontSize * 0.6}px;">▼</span>
        </div>
      </div>
    ` : "";

    const footerHtml = `
      <div style="
        position:absolute;
        bottom:0;
        left:0;
        right:0;
        height:${footerHeight}px;
        background:${THEME.bg};
        display:flex;
        align-items:center;
        justify-content:center;
        padding:0 ${contentPadding}px;
      ">
        <div style="
          width:100%;
          max-width:${maxContentWidth}px;
          background:${THEME.inputBg};
          border:1px solid ${THEME.border};
          border-radius:${baseFontSize * 1.5}px;
          padding:${baseFontSize * 0.7}px ${baseFontSize}px;
          display:flex;
          align-items:center;
          justify-content:space-between;
        ">
          <span style="
            font-size:${baseFontSize * 0.9}px;
            color:${THEME.mutedText};
          ">Reply to Claude...</span>
          <div style="
            width:${baseFontSize * 1.5}px;
            height:${baseFontSize * 1.5}px;
            background:${THEME.accent};
            border-radius:${baseFontSize * 0.4}px;
            display:flex;
            align-items:center;
            justify-content:center;
          ">
            <span style="color:white;font-size:${baseFontSize * 0.8}px;">↑</span>
          </div>
        </div>
      </div>
    `;

    return `
      <style>@keyframes blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }</style>
      <div style="
        width:${width}px;
        height:${height}px;
        background:${THEME.bg};
        font-family:'Styrene A', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        position:relative;
        overflow:hidden;
      ">
        ${headerHtml}

        <div style="
          position:absolute;
          top:${headerHeight}px;
          left:0;
          right:0;
          bottom:${footerHeight}px;
          overflow:hidden;
          display:flex;
          flex-direction:column;
          justify-content:flex-end;
          padding:${baseFontSize}px ${contentPadding}px;
        ">
          <div style="
            max-width:${maxContentWidth}px;
            width:100%;
            margin:0 auto;
          ">
            ${messagesHtml}
            ${currentThinkingHtml}
          </div>
        </div>

        ${footerHtml}
      </div>
    `;
  },
});
