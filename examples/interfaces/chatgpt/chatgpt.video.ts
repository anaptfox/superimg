import { defineScene, type RenderContext } from "superimg";

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

const TIMING_PRESETS = {
  rapid: { thinking: 0.02, userFade: 0.015, charSpeed: 0.001, hold: 0.03 },
  natural: { thinking: 0.04, userFade: 0.02, charSpeed: 0.002, hold: 0.05 },
  dramatic: { thinking: 0.06, userFade: 0.025, charSpeed: 0.003, hold: 0.07 },
};

export default defineScene<ChatGPTData>({
  data: {
    messages: [
      { id: "1", text: "How do I create a video from code?", role: "user" },
      { id: "2", text: "Use Rex Render! Just paste your code and it generates a beautiful animated video.", role: "assistant" },
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
    duration: 7,
  },
  render(ctx: RenderContext<ChatGPTData>) {
    const { std, width, height, sceneProgress, data } = ctx;
    const {
      messages,
      model,
      theme,
      timingPreset,
      showHeader,
      showThinkingIndicator,
    } = data;

    const msgCount = messages.length;
    const presetKey = timingPreset as keyof typeof TIMING_PRESETS;
    const timing = TIMING_PRESETS[presetKey] || TIMING_PRESETS.natural;

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

    // Calculate timing phases for each message
    type AssistantPhase = {
      type: "assistant";
      thinkingStart: number;
      thinkingEnd: number;
      typeStart: number;
      typeEnd: number;
      holdEnd: number;
    };

    type UserPhase = {
      type: "user";
      fadeStart: number;
      fadeEnd: number;
      holdEnd: number;
    };

    function getMessagePhase(msgIndex: number): AssistantPhase | UserPhase {
      const phasePerMsg = 0.9 / msgCount;
      const msgStart = 0.05 + msgIndex * phasePerMsg;
      const msg = messages[msgIndex];
      const isAssistant = msg?.role === "assistant";

      if (isAssistant) {
        const thinkingDur = showThinkingIndicator ? timing.thinking : 0;
        const textLen = msg?.text.length || 0;
        const typingDur = textLen * timing.charSpeed;

        return {
          type: "assistant",
          thinkingStart: msgStart,
          thinkingEnd: msgStart + thinkingDur,
          typeStart: msgStart + thinkingDur,
          typeEnd: msgStart + thinkingDur + Math.min(typingDur, phasePerMsg * 0.7),
          holdEnd: msgStart + phasePerMsg,
        };
      }

      return {
        type: "user",
        fadeStart: msgStart,
        fadeEnd: msgStart + timing.userFade,
        holdEnd: msgStart + phasePerMsg,
      };
    }

    // ChatGPT logo SVG (OpenAI icon)
    const logoSize = baseFontSize * 1.4;
    const chatGPTLogo = `
      <svg width="${logoSize}" height="${logoSize}" viewBox="0 0 41 41" fill="none">
        <path d="M37.5324 16.8707C37.9808 15.5241 38.1363 14.0974 37.9886 12.6859C37.8409 11.2744 37.3934 9.91076 36.676 8.68622C35.6126 6.83404 33.9882 5.3676 32.0373 4.4985C30.0864 3.62941 27.9098 3.40259 25.8215 3.85078C24.8796 2.7893 23.7219 1.94125 22.4257 1.36341C21.1295 0.785575 19.7249 0.491269 18.3058 0.500197C16.1708 0.495044 14.0893 1.16803 12.3614 2.42214C10.6335 3.67624 9.34853 5.44666 8.6917 7.47815C7.30085 7.76286 5.98686 8.3414 4.8377 9.17505C3.68854 10.0087 2.73073 11.0782 2.02839 12.312C0.956464 14.1591 0.498905 16.2988 0.721698 18.4228C0.944492 20.5467 1.83612 22.5449 3.268 24.1293C2.81966 25.4759 2.66413 26.9026 2.81182 28.3141C2.95951 29.7256 3.40701 31.0892 4.12437 32.3138C5.18791 34.1659 6.81233 35.6324 8.76321 36.5014C10.7141 37.3705 12.8907 37.5973 14.9789 37.1492C15.9208 38.2107 17.0786 39.0587 18.3747 39.6366C19.6709 40.2144 21.0755 40.5087 22.3946 40.4998C24.5319 40.5054 26.6157 39.8321 28.3453 38.5772C30.0748 37.3223 31.3345 35.5506 32.0158 33.5179C33.4065 33.2332 34.7203 32.6547 35.8693 31.8211C37.0183 30.9875 37.9759 29.9183 38.6782 28.6846C39.7451 26.8398 40.199 24.7043 39.976 22.5849C39.7529 20.4656 38.8645 18.4715 37.5324 16.8707ZM22.4978 37.8849C20.7443 37.8874 19.0459 37.2733 17.6994 36.1501C17.7601 36.117 17.8666 36.0586 17.936 36.0161L25.9004 31.4156C26.1003 31.3019 26.2663 31.137 26.3813 30.9378C26.4964 30.7386 26.5563 30.5124 26.5549 30.2825V19.0542L29.9213 20.998C29.9389 21.0068 29.9541 21.0198 29.9656 21.0359C29.977 21.052 29.9183 21.0707 29.9183 21.0902V30.3889C29.9842 32.375 29.1946 34.2791 27.7909 35.6841C26.3872 37.0892 24.4838 37.8806 22.4978 37.8849ZM6.39227 31.0064C5.51397 29.4888 5.19742 27.7107 5.49804 25.9832C5.55718 26.0187 5.55279 26.0835 5.73539 26.1326L13.6996 30.7332C13.8954 30.8458 14.1553 30.8458 14.4017 30.7332L24.1517 25.1082C24.3524 24.9942 24.5187 24.8288 24.6337 24.6292C24.7487 24.4296 24.8082 24.203 24.8063 23.9727V12.7025L28.1726 14.6467C28.1903 14.6555 28.2055 14.6685 28.2169 14.6846C28.2284 14.7007 28.2356 14.7194 28.2378 14.7389V24.0698C28.2349 26.0559 27.4419 27.9599 26.0349 29.3608C24.6279 30.7617 22.7208 31.5482 20.7315 31.5482C19.7962 31.5482 18.8627 31.3666 17.9829 31.0064L6.39227 31.0064ZM4.29707 13.6194C5.17156 12.0998 6.55279 10.9364 8.19885 10.3327C8.19885 10.4013 8.19415 10.5228 8.19415 10.6071V19.8989C8.19252 20.1262 8.24995 20.3499 8.36117 20.5485C8.47238 20.7471 8.6334 20.9137 8.82866 21.0319L18.5765 26.6555L15.2102 28.5997C15.1926 28.6093 15.1726 28.6146 15.1527 28.6146C15.1327 28.6146 15.1127 28.6093 15.0951 28.5997L7.16711 24.0181C5.40739 23.0029 4.12156 21.3708 3.54127 19.4445C2.96099 17.5182 3.12857 15.4414 4.01397 13.6194L4.29707 13.6194ZM31.955 20.0556L22.2044 14.4299L25.5706 12.4857C25.5882 12.4762 25.6082 12.4708 25.6082 12.4708C25.6481 12.4708 25.6681 12.4762 25.6857 12.4857L33.6125 17.0674C34.7871 17.7499 35.7649 18.7206 36.4562 19.8896C37.1476 21.0586 37.5275 22.3863 37.5601 23.7467C37.5926 25.1071 37.2763 26.4528 36.6415 27.655C36.0067 28.8573 35.0748 29.8756 33.9345 29.8756L31.955 20.0556ZM35.3055 15.0128C35.2464 14.9765 35.1431 14.9142 35.0755 14.8686L27.1003 10.2668C26.8525 10.1531 26.5933 10.0942 26.33 10.0942C26.0667 10.0942 25.8039 10.1531 25.5548 10.2668L15.8049 15.8918C15.604 16.0054 15.4375 16.1706 15.3224 16.3701C15.2073 16.5695 15.1477 16.7961 15.1496 17.0265V28.2985L11.7832 26.3553C11.7656 26.3457 11.7504 26.3327 11.739 26.3166C11.7275 26.3005 11.7203 26.2818 11.7181 26.2623V16.8977C11.7221 14.9113 12.5157 13.0073 13.9225 11.6062C15.3293 10.2051 17.2361 9.41883 19.2254 9.41883C20.1607 9.41883 21.0942 9.60002 21.9739 9.96056L35.3055 15.0128ZM14.2424 21.9419L10.8761 20C10.8584 19.9912 10.8432 19.9782 10.8318 19.9621C10.8203 19.946 10.8131 19.9273 10.8109 19.9078V10.6415C10.8144 8.65325 11.6105 6.74797 13.0216 5.3476C14.4326 3.94723 16.3445 3.16475 18.3379 3.16948C19.2731 3.16977 20.2066 3.35131 21.0863 3.71168C21.0263 3.74487 20.9204 3.80314 20.851 3.84553L12.8886 8.44595C12.6888 8.55976 12.5228 8.7247 12.4077 8.92398C12.2927 9.12326 12.2328 9.34944 12.2342 9.57937L12.2342 21.9419H14.2424Z" fill="${THEME.accent}"/>
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
      const phase = getMessagePhase(i);
      const isAssistant = msg.role === "assistant";

      if (isAssistant && phase.type === "assistant") {
        // Check thinking phase
        if (showThinkingIndicator) {
          const thinkingProgress = std.interpolate(sceneProgress, [phase.thinkingStart, phase.thinkingEnd], [0, 1]);
          if (thinkingProgress > 0 && thinkingProgress < 1) {
            currentThinkingHtml = renderThinkingIndicator(thinkingProgress);
          }
        }

        // Typewriter effect
        const typeProgress = std.interpolate(sceneProgress, [phase.typeStart, phase.typeEnd], [0, 1]);
        if (typeProgress <= 0) continue;

        const visibleChars = Math.floor(typeProgress * msg.text.length);
        const displayText = msg.text.substring(0, visibleChars);
        const showCursor = typeProgress < 1;
        const cursorHtml = showCursor ? `<span style="
          display:inline-block;
          width:2px;
          height:1.1em;
          background:${THEME.text};
          margin-left:2px;
          vertical-align:text-bottom;
          animation:blink 0.5s infinite;
        "></span>` : "";

        const opacity = std.interpolate(Math.min(typeProgress * 5, 1), [0, 1], [0, 1], "easeOutCubic");

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
      } else if (phase.type === "user") {
        // User message - instant fade in
        const fadeProgress = std.interpolate(sceneProgress, [phase.fadeStart, phase.fadeEnd], [0, 1]);
        if (fadeProgress <= 0) continue;

        const opacity = std.interpolate(fadeProgress, [0, 1], [0, 1], "easeOutCubic");
        const translateY = std.interpolate(fadeProgress, [0, 1], [10, 0], "easeOutCubic");

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
