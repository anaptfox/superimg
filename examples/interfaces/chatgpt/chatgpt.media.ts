import { define, layoutTimeline, type RenderContext } from "superimg";

export interface ChatMessage {
  id: string;
  text: string;
  role: "user" | "assistant";
}

export interface ChatGPTData extends Record<string, unknown> {
  messages: ChatMessage[];
  model: "gpt-5.1-codex-mini" | "gpt-4" | "gpt-3.5";
  theme: "dark" | "light";
  timingPreset: "rapid" | "natural" | "dramatic";
  showHeader: boolean;
  showThinkingIndicator: boolean;
}

function messageWeight(text: string): number {
  return Math.max(1.2, text.length / 45);
}

function estimateChatTimeline(data: ChatGPTData) {
  const pace =
    data.timingPreset === "rapid" ? 0.85 : data.timingPreset === "dramatic" ? 1.25 : 1;
  const weights = data.messages.map((m) => messageWeight(m.text));
  const messagesS = Math.max(2, weights.reduce((a, w) => a + w, 0) * 1.45 * pace);
  const holdS = Math.max(0.55, messagesS * (1 / 9));
  return layoutTimeline({ messages: messagesS, hold: holdS });
}

export default define<ChatGPTData>({
  sample: {
    messages: [
      { id: "1", text: "How do I create a video from code?", role: "user" },
      { id: "2", text: "Use SuperImg! Write an HTML/CSS template in TypeScript and render it to MP4 — perfect for dev demos and social clips.", role: "assistant" },
    ],
    model: "gpt-5.1-codex-mini",
    theme: "dark",
    timingPreset: "natural",
    showHeader: true,
    showThinkingIndicator: true,
  },
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: "7s", // AST fallback; resolve() overrides
  },
  resolve({ data }) {
    const { totalSeconds, phases } = estimateChatTimeline(data);
    return { duration: `${totalSeconds}s`, phases };
  },
  render(ctx: RenderContext<ChatGPTData>) {
    const { std, width, height, timeline, data } = ctx;
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

    // Colors
    const THEME = theme === "dark" ? {
      bg: "#212121",
      userBg: "#2f2f2f",
      assistantBg: "transparent",
      text: "#ececec",
      mutedText: "#8e8e8e",
      accent: "#10a37f",
      border: "#444444",
      headerBg: "#212121",
      inputBg: "#2f2f2f",
    } : {
      bg: "#ffffff",
      userBg: "#f7f7f8",
      assistantBg: "transparent",
      text: "#374151",
      mutedText: "#6b7280",
      accent: "#10a37f",
      border: "#e5e5e5",
      headerBg: "#ffffff",
      inputBg: "#f7f7f8",
    };

    // Layout calculations
    const baseFontSize = Math.min(width, height) * 0.03;
    const headerHeight = showHeader ? height * 0.08 : 0;
    const footerHeight = height * 0.1;
    const contentPadding = width * 0.06;
    const maxContentWidth = Math.min(width * 0.85, 680);
    const messageGap = baseFontSize * 1.5;

    // ChatGPT logo SVG (OpenAI icon)
    const logoSize = baseFontSize * 1.4;
    const chatGPTLogo = `
      <svg width="${logoSize}" height="${logoSize}" viewBox="0 0 41 41" fill="none">
        <path d="M37.5 16.9C38.0 15.5 38.1 14.1 38.0 12.7C37.8 11.3 37.4 9.9 36.7 8.7C35.6 6.8 34.0 5.4 32.0 4.5C30.1 3.6 27.9 3.4 25.8 3.9C24.9 2.8 23.7 1.9 22.4 1.4C21.1 0.8 19.7 0.5 18.3 0.5C16.2 0.5 14.1 1.2 12.4 2.4C10.6 3.7 9.3 5.4 8.7 7.5C7.3 7.8 6.0 8.3 4.8 9.2C3.7 10.0 2.7 11.1 2.0 12.3C1.0 14.2 0.5 16.3 0.7 18.4C0.9 20.5 1.8 22.5 3.3 24.1C2.8 25.5 2.7 26.9 2.8 28.3C3.0 29.7 3.4 31.1 4.1 32.3C5.2 34.2 6.8 35.6 8.8 36.5C10.7 37.4 12.9 37.6 15.0 37.1C15.9 38.2 17.1 39.1 18.4 39.6C19.7 40.2 21.1 40.5 22.4 40.5C24.5 40.5 26.6 39.8 28.3 38.6C30.1 37.3 31.3 35.6 32.0 33.5C33.4 33.2 34.7 32.7 35.9 31.8C37.0 31.0 38.0 29.9 38.7 28.7C39.7 26.8 40.2 24.7 40.0 22.6C39.8 20.5 38.9 18.5 37.5 16.9ZM22.5 37.9C20.7 37.9 19.0 37.3 17.7 36.2C17.8 36.1 17.9 36.1 17.9 36.0L25.9 31.4C26.1 31.3 26.3 31.1 26.4 30.9C26.5 30.7 26.6 30.5 26.6 30.3V19.1L29.9 21.0C29.9 21.0 30.0 21.0 30.0 21.0C30.0 21.1 29.9 21.1 29.9 21.1V30.4C30.0 32.4 29.2 34.3 27.8 35.7C26.4 37.1 24.5 37.9 22.5 37.9ZM6.4 31.0C5.5 29.5 5.2 27.7 5.5 26.0C5.6 26.0 5.6 26.1 5.7 26.1L13.7 30.7C13.9 30.8 14.2 30.8 14.4 30.7L24.2 25.1C24.4 25.0 24.5 24.8 24.6 24.6C24.7 24.4 24.8 24.2 24.8 24.0V12.7L28.2 14.6C28.2 14.7 28.2 14.7 28.2 14.7C28.2 14.7 28.2 14.7 28.2 14.7V24.1C28.2 26.1 27.4 28.0 26.0 29.4C24.6 30.8 22.7 31.5 20.7 31.5C19.8 31.5 18.9 31.4 18.0 31.0L6.4 31.0ZM4.3 13.6C5.2 12.1 6.6 10.9 8.2 10.3C8.2 10.4 8.2 10.5 8.2 10.6V19.9C8.2 20.1 8.2 20.3 8.4 20.5C8.5 20.7 8.6 20.9 8.8 21.0L18.6 26.7L15.2 28.6C15.2 28.6 15.2 28.6 15.2 28.6C15.1 28.6 15.1 28.6 15.1 28.6L7.2 24.0C5.4 23.0 4.1 21.4 3.5 19.4C3.0 17.5 3.1 15.4 4.0 13.6L4.3 13.6ZM32.0 20.1L22.2 14.4L25.6 12.5C25.6 12.5 25.6 12.5 25.6 12.5C25.6 12.5 25.7 12.5 25.7 12.5L33.6 17.1C34.8 17.7 35.8 18.7 36.5 19.9C37.1 21.1 37.5 22.4 37.6 23.7C37.6 25.1 37.3 26.5 36.6 27.7C36.0 28.9 35.1 29.9 33.9 29.9L32.0 20.1ZM35.3 15.0C35.2 15.0 35.1 14.9 35.1 14.9L27.1 10.3C26.9 10.2 26.6 10.1 26.3 10.1C26.1 10.1 25.8 10.2 25.6 10.3L15.8 15.9C15.6 16.0 15.4 16.2 15.3 16.4C15.2 16.6 15.1 16.8 15.1 17.0V28.3L11.8 26.4C11.8 26.3 11.8 26.3 11.7 26.3C11.7 26.3 11.7 26.3 11.7 26.3V16.9C11.7 14.9 12.5 13.0 13.9 11.6C15.3 10.2 17.2 9.4 19.2 9.4C20.2 9.4 21.1 9.6 22.0 10.0L35.3 15.0ZM14.2 21.9L10.9 20C10.9 20.0 10.8 20.0 10.8 20.0C10.8 19.9 10.8 19.9 10.8 19.9V10.6C10.8 8.7 11.6 6.7 13.0 5.3C14.4 3.9 16.3 3.2 18.3 3.2C19.3 3.2 20.2 3.4 21.1 3.7C21.0 3.7 20.9 3.8 20.9 3.8L12.9 8.4C12.7 8.6 12.5 8.7 12.4 8.9C12.3 9.1 12.2 9.3 12.2 9.6L12.2 21.9H14.2Z" fill="${THEME.accent}"/>
      </svg>
    `;

    // Thinking indicator (3 pulsing dots)
    function renderThinkingIndicator(progress: number): string {
      const dotSize = baseFontSize * 0.35;
      const dots = [];

      for (let i = 0; i < 3; i++) {
        const phase = (progress * 2 + i * 0.3) % 1;
        const opacity = 0.3 + Math.sin(phase * Math.PI) * 0.7;
        dots.push(`<div style="
          width:${dotSize}px;
          height:${dotSize}px;
          background:${THEME.mutedText};
          border-radius:50%;
          opacity:${opacity};
        "></div>`);
      }

      return `
        <div style="
          display:flex;
          align-items:center;
          gap:${dotSize * 0.8}px;
          padding:${baseFontSize * 0.5}px 0;
        ">
          ${chatGPTLogo}
          <div style="display:flex;gap:${dotSize * 0.5}px;margin-left:${baseFontSize * 0.5}px;">
            ${dots.join("")}
          </div>
        </div>
      `;
    }

    // Build messages HTML
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
          background:${THEME.text};
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
            ${chatGPTLogo}
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

    // Header HTML
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
          ${chatGPTLogo}
          <span>ChatGPT</span>
        </div>
        <div style="
          display:flex;
          align-items:center;
          gap:${baseFontSize * 0.3}px;
          font-size:${baseFontSize * 0.85}px;
          color:${THEME.mutedText};
          background:${THEME.userBg};
          padding:${baseFontSize * 0.3}px ${baseFontSize * 0.6}px;
          border-radius:${baseFontSize * 0.5}px;
        ">
          <span>${model.toUpperCase()}</span>
          <span style="font-size:${baseFontSize * 0.6}px;">▼</span>
        </div>
      </div>
    ` : "";

    // Footer (input area - decorative)
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
          ">Message ChatGPT...</span>
          <div style="
            width:${baseFontSize * 1.5}px;
            height:${baseFontSize * 1.5}px;
            background:${THEME.mutedText};
            border-radius:${baseFontSize * 0.4}px;
            display:flex;
            align-items:center;
            justify-content:center;
          ">
            <span style="color:${THEME.bg};font-size:${baseFontSize * 0.8}px;">↑</span>
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
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
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
