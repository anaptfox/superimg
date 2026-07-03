// Personalized Video
// Dynamic content with variable substitution

// These would be replaced at render time
const USER = {
  name: "{name}",
  company: "{company}",
  plan: "Pro",
};

import { define } from "superimg";
export default define({
  render(ctx) {
  const { width, height, timeline } = ctx;

  // Animation phases
  const welcomePhase = Math.min(1, timeline.progress * 3);
  const namePhase = Math.max(0, Math.min(1, (timeline.progress - 0.2) * 2.5));
  const detailsPhase = Math.max(0, Math.min(1, (timeline.progress - 0.5) * 2));

  return `
    <div style="
      width: ${width}px;
      height: ${height}px;
      background: linear-gradient(135deg, #1e3a5f 0%, #2d1b4e 100%);
      font-family: system-ui, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px;
      box-sizing: border-box;
    ">
      <!-- Welcome text -->
      <div style="
        font-size: 24px;
        color: rgba(255,255,255,0.7);
        margin-bottom: 16px;
        opacity: ${welcomePhase};
        transform: translateY(${(1 - welcomePhase) * 20}px);
      ">Welcome to SuperImg</div>

      <!-- Personalized name -->
      <div style="
        font-size: 64px;
        font-weight: 700;
        background: linear-gradient(90deg, #60a5fa, #a78bfa, #f472b6);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 32px;
        opacity: ${namePhase};
        transform: scale(${0.9 + namePhase * 0.1});
      ">Hey, ${USER.name}!</div>

      <!-- Details card -->
      <div style="
        background: rgba(255,255,255,0.1);
        backdrop-filter: blur(10px);
        border-radius: 16px;
        padding: 32px 48px;
        text-align: center;
        opacity: ${detailsPhase};
        transform: translateY(${(1 - detailsPhase) * 20}px);
      ">
        <div style="
          font-size: 18px;
          color: rgba(255,255,255,0.7);
          margin-bottom: 8px;
        ">Your ${USER.plan} plan for</div>
        <div style="
          font-size: 32px;
          font-weight: 600;
          color: white;
        ">${USER.company}</div>
        <div style="
          font-size: 16px;
          color: #10b981;
          margin-top: 16px;
        ">✓ is ready to go!</div>
      </div>

      <!-- CTA hint -->
      <div style="
        margin-top: 40px;
        font-size: 16px;
        color: rgba(255,255,255,0.5);
        opacity: ${detailsPhase};
      ">Check your inbox for next steps →</div>

      <!-- Variable hint for devs -->
      <div style="
        position: absolute;
        bottom: 20px;
        font-size: 12px;
        color: rgba(255,255,255,0.3);
        font-family: monospace;
      ">Variables: {name}, {company}</div>
    </div>
  `;
  },
});