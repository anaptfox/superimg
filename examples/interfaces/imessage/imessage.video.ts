import { defineScene, type RenderContext } from "superimg";

export interface Reaction {
  emoji: string;
  sender: "user" | "contact";
}

export interface Message {
  id: string;
  text: string;
  sender: "user" | "contact";
  typingHesitation?: boolean;
  reactions?: Reaction[];
}

export interface iMessageData extends Record<string, unknown> {
  contactName: string;
  contactAvatar?: string;
  messages: Message[];
  theme: "light" | "dark";
  timingPreset: "rapid" | "natural" | "dramatic";
  showHeader: boolean;
  showTypingIndicator: boolean;
}

const TIMING_PRESETS = {
  rapid: { typing: 0.025, gap: 0.02, hold: 0.035 },
  natural: { typing: 0.055, gap: 0.04, hold: 0.055 },
  dramatic: { typing: 0.085, gap: 0.055, hold: 0.070 },
};

export default defineScene<iMessageData>({
  data: {
    contactName: "Rex",
    messages: [
      { id: "1", text: "Hey, did you see Rex Render?", sender: "contact" },
      { id: "2", text: "It's amazing for dev videos!", sender: "contact" },
      { id: "3", text: "Just shipped my first one", sender: "user" },
    ],
    theme: "light",
    timingPreset: "natural",
    showHeader: true,
    showTypingIndicator: true,
  },
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 11.4,
  },
  render(ctx: RenderContext<iMessageData>) {
    const { std, width, height, sceneProgress, data } = ctx;
    const {
      contactName,
      contactAvatar,
      messages,
      theme,
      timingPreset,
      showHeader,
      showTypingIndicator,
    } = data;

    const msgCount = messages.length;
    const presetKey = timingPreset as keyof typeof TIMING_PRESETS;
    const timing = TIMING_PRESETS[presetKey] || TIMING_PRESETS.natural;

    // Colors
    const THEME = theme === "dark" ? {
      bg: "#000000",
      headerBg: "#1C1C1E",
      userBubble: "linear-gradient(180deg, #007AFF 0%, #0066DD 100%)",
      userText: "#ffffff",
      contactBubble: "#3A3A3C",
      contactText: "#ffffff",
      headerText: "#ffffff",
      mutedText: "#8E8E93",
      footerBg: "#1C1C1E",
    } : {
      bg: "#ffffff",
      headerBg: "#F6F6F6",
      userBubble: "linear-gradient(180deg, #007AFF 0%, #0066DD 100%)",
      userText: "#ffffff",
      contactBubble: "#E9E9EB",
      contactText: "#000000",
      headerText: "#000000",
      mutedText: "#8E8E93",
      footerBg: "#F6F6F6",
    };

    // Layout calculations
    const baseFontSize = Math.min(width, height) * 0.032;
    const headerHeight = showHeader ? height * 0.08 : 0;
    const footerHeight = height * 0.055;
    const chatPadding = width * 0.04;
    const bubbleMaxWidth = width * 0.75;
    const messageGap = baseFontSize * 0.8;

    // Calculate message timing phases
    function getMessagePhase(msgIndex: number): {
      typingStart: number;
      typingEnd: number;
      bubbleStart: number;
      bubbleEnd: number;
      holdEnd: number;
    } {
      const phasePerMsg = 0.9 / msgCount;
      const msgStart = 0.05 + msgIndex * phasePerMsg;

      const msg = messages[msgIndex];
      const needsTyping = showTypingIndicator && msg?.sender === "contact";

      const typingDur = needsTyping ? timing.typing : 0;
      const bubbleDur = timing.gap;
      const holdDur = timing.hold;

      return {
        typingStart: msgStart,
        typingEnd: msgStart + typingDur,
        bubbleStart: msgStart + typingDur,
        bubbleEnd: msgStart + typingDur + bubbleDur,
        holdEnd: msgStart + typingDur + bubbleDur + holdDur,
      };
    }

    // Typing indicator HTML
    function renderTypingIndicator(progress: number): string {
      const dotSize = baseFontSize * 0.4;
      const bounceOffset = [0, 0.2, 0.4];

      let dotsHtml = "";
      for (let i = 0; i < 3; i++) {
        const dotProgress = (progress * 3 + bounceOffset[i]!) % 1;
        const bounce = Math.sin(dotProgress * Math.PI) * 4;
        dotsHtml += `<div style="
          width:${dotSize}px;
          height:${dotSize}px;
          background:${THEME.mutedText};
          border-radius:50%;
          transform:translateY(${-bounce}px);
        "></div>`;
      }

      return `<div style="
        display:flex;
        justify-content:flex-start;
        margin-left:${chatPadding}px;
      ">
        <div style="
          display:inline-flex;
          align-items:center;
          gap:${dotSize * 0.5}px;
          padding:${baseFontSize * 0.8}px ${baseFontSize * 1}px;
          background:${THEME.contactBubble};
          border-radius:${baseFontSize}px ${baseFontSize}px ${baseFontSize}px ${baseFontSize * 0.25}px;
        ">${dotsHtml}</div>
      </div>`;
    }

    // Message bubble animation
    function getBubbleTransform(enterProgress: number): { transform: string; opacity: number } {
      const scale = std.interpolate(enterProgress, [0, 1], [0.3, 1], "easeOutBack");
      const translateY = std.interpolate(enterProgress, [0, 1], [20, 0], "easeOutCubic");
      return {
        transform: `scale(${scale}) translateY(${translateY}px)`,
        opacity: std.interpolate(Math.min(enterProgress * 2, 1), [0, 1], [0, 1], "linear"),
      };
    }

    // Render reactions
    function renderReactions(reactions: Reaction[] | undefined, isUser: boolean): string {
      if (!reactions || reactions.length === 0) return "";

      const reactionSize = baseFontSize * 1.2;
      const position = isUser ? "left:-8px;" : "right:-8px;";

      return reactions.map((r, i) => `
        <div style="
          position:absolute;
          bottom:-${reactionSize * 0.4}px;
          ${position}
          background:${theme === "dark" ? "#2C2C2E" : "#ffffff"};
          border-radius:${reactionSize}px;
          padding:${reactionSize * 0.15}px ${reactionSize * 0.25}px;
          font-size:${reactionSize * 0.8}px;
          box-shadow:0 1px 3px rgba(0,0,0,0.2);
          transform:translateX(${i * reactionSize * 0.6}px);
        ">${r.emoji}</div>
      `).join("");
    }

    // Build messages HTML
    let messagesHtml = "";
    let currentTypingHtml = "";

    for (let i = 0; i < msgCount; i++) {
      const msg = messages[i]!;
      const phase = getMessagePhase(i);
      const isUser = msg.sender === "user";

      // Check if we're in typing phase for this message (with hesitation support)
      if (showTypingIndicator && !isUser) {
        const typingProgress = std.interpolate(sceneProgress, [phase.typingStart, phase.typingEnd], [0, 1]);
        if (typingProgress > 0 && typingProgress < 1) {
          // Typing hesitation: show/hide/show pattern (30/25/45 split)
          if (msg.typingHesitation) {
            const showTyping = typingProgress < 0.30 || typingProgress > 0.55;
            if (showTyping) {
              const adjustedProgress = typingProgress < 0.30
                ? typingProgress / 0.30
                : Math.min((typingProgress - 0.55) / 0.45 * 1.3, 1);
              currentTypingHtml = renderTypingIndicator(adjustedProgress);
            } else {
              currentTypingHtml = "";
            }
          } else {
            currentTypingHtml = renderTypingIndicator(typingProgress);
          }
        }
      }

      // Check if bubble should be visible
      const bubbleProgress = std.interpolate(sceneProgress, [phase.bubbleStart, phase.bubbleEnd], [0, 1]);
      if (bubbleProgress <= 0) continue;

      const enterProgress = Math.min(bubbleProgress * 2, 1);
      const { transform, opacity } = getBubbleTransform(enterProgress);

      const bubbleStyle = isUser
        ? `background:${THEME.userBubble};color:${THEME.userText};border-radius:${baseFontSize}px ${baseFontSize}px ${baseFontSize * 0.25}px ${baseFontSize}px;margin-left:auto;margin-right:${chatPadding}px;`
        : `background:${THEME.contactBubble};color:${THEME.contactText};border-radius:${baseFontSize}px ${baseFontSize}px ${baseFontSize}px ${baseFontSize * 0.25}px;margin-left:${chatPadding}px;`;

      const transformOrigin = isUser ? "bottom right" : "bottom left";

      messagesHtml += `
        <div style="
          position:relative;
          max-width:${bubbleMaxWidth}px;
          padding:${baseFontSize * 0.7}px ${baseFontSize}px;
          ${bubbleStyle}
          font-size:${baseFontSize}px;
          line-height:1.35;
          transform:${transform};
          transform-origin:${transformOrigin};
          opacity:${opacity};
          margin-bottom:${messageGap}px;
          word-wrap:break-word;
        ">
          ${msg.text}
          ${renderReactions(msg.reactions, isUser)}
        </div>
      `;
    }

    // Header HTML - minimal: just avatar + name
    const headerHtml = showHeader ? `
      <div style="
        height:${headerHeight}px;
        background:${THEME.headerBg};
        display:flex;
        align-items:center;
        justify-content:center;
        gap:${baseFontSize * 0.5}px;
      ">
        ${contactAvatar ? `
          <img src="${contactAvatar}" style="
            width:${baseFontSize * 2}px;
            height:${baseFontSize * 2}px;
            border-radius:50%;
            object-fit:cover;
          " />
        ` : `
          <div style="
            width:${baseFontSize * 2}px;
            height:${baseFontSize * 2}px;
            border-radius:50%;
            background:linear-gradient(135deg, #A8A8AA 0%, #8E8E93 100%);
            display:flex;
            align-items:center;
            justify-content:center;
            color:white;
            font-size:${baseFontSize * 0.9}px;
            font-weight:600;
          ">${contactName.charAt(0).toUpperCase()}</div>
        `}
        <span style="
          font-size:${baseFontSize * 0.95}px;
          font-weight:600;
          color:${THEME.headerText};
        ">${contactName}</span>
      </div>
    ` : "";

    // Footer HTML - authentic iMessage input bar
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
        padding:0 ${baseFontSize * 0.5}px;
      ">
        <div style="
          flex:1;
          height:${baseFontSize * 2.2}px;
          background:${theme === "dark" ? "#1C1C1E" : "#FFFFFF"};
          border:1px solid ${theme === "dark" ? "#38383A" : "#C6C6C8"};
          border-radius:${baseFontSize * 1.1}px;
          display:flex;
          align-items:center;
          padding:0 ${baseFontSize * 0.7}px;
          position:relative;
        ">
          <span style="
            color:#8E8E93;
            font-size:${baseFontSize * 0.95}px;
          ">iMessage</span>
          <div style="
            position:absolute;
            right:${baseFontSize * 0.4}px;
            width:${baseFontSize * 1.6}px;
            height:${baseFontSize * 1.6}px;
            border-radius:50%;
            background:${theme === "dark" ? "#38383A" : "#E5E5EA"};
            display:flex;
            align-items:center;
            justify-content:center;
          ">
            <span style="
              color:#8E8E93;
              font-size:${baseFontSize * 0.9}px;
              line-height:1;
              margin-top:-1px;
            ">↑</span>
          </div>
        </div>
      </div>
    `;

    return `
      <div style="
        width:${width}px;
        height:${height}px;
        background:${THEME.bg};
        font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,sans-serif;
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
          padding-bottom:${baseFontSize}px;
        ">
          ${messagesHtml}
          ${currentTypingHtml}
        </div>

        ${footerHtml}
      </div>
    `;
  },
});
