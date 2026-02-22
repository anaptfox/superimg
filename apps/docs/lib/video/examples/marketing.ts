export const PRODUCT_HUNT = `// Product Hunt Launch Card
// Animated launch card with upvote counter

const PRODUCT = {
  name: "SuperImg",
  tagline: "Programmatic video generation for developers",
  icon: "🎬",
  upvotes: 847,
  rank: 1,
};

export function render(ctx) {
  const { width, height, sceneProgress } = ctx;

  // Animate upvote count with easing
  const eased = 1 - Math.pow(1 - Math.min(1, sceneProgress * 1.3), 3);
  const currentUpvotes = Math.floor(PRODUCT.upvotes * eased);

  // Card scale animation
  const cardScale = 0.9 + Math.min(0.1, sceneProgress * 0.15);
  const cardOpacity = Math.min(1, sceneProgress * 2);

  // Upvote button pulse
  const pulseScale = 1 + Math.sin(sceneProgress * Math.PI * 4) * 0.05;

  return \`
    <div style="
      width: \${width}px;
      height: \${height}px;
      background: linear-gradient(135deg, #ff6154 0%, #ff8c42 100%);
      font-family: system-ui, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="
        background: white;
        border-radius: 16px;
        padding: 32px;
        display: flex;
        gap: 24px;
        align-items: center;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        transform: scale(\${cardScale});
        opacity: \${cardOpacity};
      ">
        <!-- Product Icon -->
        <div style="
          width: 80px;
          height: 80px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 40px;
        ">\${PRODUCT.icon}</div>

        <!-- Product Info -->
        <div style="flex: 1;">
          <div style="
            font-size: 24px;
            font-weight: 700;
            color: #1a1a1a;
            margin-bottom: 8px;
          ">\${PRODUCT.name}</div>
          <div style="
            font-size: 16px;
            color: #666;
          ">\${PRODUCT.tagline}</div>
        </div>

        <!-- Upvote Button -->
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 16px 24px;
          background: \${sceneProgress > 0.3 ? '#ff6154' : '#f5f5f5'};
          border-radius: 8px;
          transform: scale(\${pulseScale});
          transition: background 0.3s;
        ">
          <div style="
            font-size: 24px;
            color: \${sceneProgress > 0.3 ? 'white' : '#ff6154'};
          ">▲</div>
          <div style="
            font-size: 20px;
            font-weight: 700;
            color: \${sceneProgress > 0.3 ? 'white' : '#1a1a1a'};
          ">\${currentUpvotes}</div>
        </div>
      </div>

      <!-- Rank Badge -->
      <div style="
        position: absolute;
        top: 60px;
        right: 80px;
        background: #ff6154;
        color: white;
        padding: 12px 24px;
        border-radius: 100px;
        font-weight: 700;
        font-size: 18px;
        opacity: \${Math.min(1, (sceneProgress - 0.5) * 3)};
        transform: translateY(\${(1 - Math.min(1, (sceneProgress - 0.5) * 3)) * 20}px);
      ">
        #\${PRODUCT.rank} Product of the Day
      </div>
    </div>
  \`;
}`;

export const YEAR_IN_REVIEW = `// Year in Review / Wrapped
// Spotify Wrapped-style stats reveal

const STATS = [
  { label: "Lines of Code", value: "127,493", icon: "💻" },
  { label: "Commits", value: "1,247", icon: "📝" },
  { label: "Pull Requests", value: "389", icon: "🔀" },
  { label: "Issues Closed", value: "156", icon: "✅" },
];

const YEAR = "2025";

export function render(ctx) {
  const { width, height, sceneProgress } = ctx;

  // Gradient rotation
  const gradientAngle = sceneProgress * 45;

  return \`
    <div style="
      width: \${width}px;
      height: \${height}px;
      background: linear-gradient(\${135 + gradientAngle}deg, #1a1a2e 0%, #2d1b4e 50%, #1e3a5f 100%);
      font-family: system-ui, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
    ">
      <!-- Year Badge -->
      <div style="
        font-size: 72px;
        font-weight: 800;
        background: linear-gradient(90deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 40px;
        opacity: \${Math.min(1, sceneProgress * 3)};
        transform: scale(\${0.8 + Math.min(0.2, sceneProgress * 0.4)});
      ">\${YEAR} Wrapped</div>

      <!-- Stats Grid -->
      <div style="
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 24px;
      ">
        \${STATS.map((stat, i) => {
          const delay = i * 0.15;
          const opacity = Math.min(1, Math.max(0, (sceneProgress - delay - 0.2) * 3));
          const translateY = (1 - opacity) * 30;
          return \`
            <div style="
              background: rgba(255,255,255,0.1);
              backdrop-filter: blur(10px);
              border-radius: 16px;
              padding: 24px 32px;
              text-align: center;
              opacity: \${opacity};
              transform: translateY(\${translateY}px);
            ">
              <div style="font-size: 36px; margin-bottom: 8px;">\${stat.icon}</div>
              <div style="
                font-size: 36px;
                font-weight: 700;
                color: white;
                margin-bottom: 4px;
              ">\${stat.value}</div>
              <div style="
                font-size: 14px;
                color: rgba(255,255,255,0.7);
                text-transform: uppercase;
                letter-spacing: 1px;
              ">\${stat.label}</div>
            </div>
          \`;
        }).join('')}
      </div>

      <!-- Decorative circles -->
      <div style="
        position: absolute;
        width: 300px;
        height: 300px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(255,107,107,0.3) 0%, transparent 70%);
        top: -100px;
        right: -100px;
        opacity: \${sceneProgress};
      "></div>
      <div style="
        position: absolute;
        width: 200px;
        height: 200px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(72,219,251,0.3) 0%, transparent 70%);
        bottom: -50px;
        left: -50px;
        opacity: \${sceneProgress};
      "></div>
    </div>
  \`;
}`;

export const COUNTDOWN = `// Countdown Timer
// Event countdown with flip animation effect

const EVENT = {
  name: "Product Launch",
  date: "2025-03-01T00:00:00",
};

// For demo, we'll show a fixed countdown that animates
const COUNTDOWN_VALUES = { days: 14, hours: 8, mins: 32, secs: 45 };

export function render(ctx) {
  const { width, height, sceneProgress } = ctx;

  // Simulate countdown animation
  const animatedSecs = Math.floor(COUNTDOWN_VALUES.secs - (sceneProgress * 10) % 60);

  const units = [
    { label: "DAYS", value: COUNTDOWN_VALUES.days },
    { label: "HOURS", value: COUNTDOWN_VALUES.hours },
    { label: "MINS", value: COUNTDOWN_VALUES.mins },
    { label: "SECS", value: Math.abs(animatedSecs) },
  ];

  return \`
    <div style="
      width: \${width}px;
      height: \${height}px;
      background: linear-gradient(180deg, #0f0f23 0%, #1a1a3e 100%);
      font-family: system-ui, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    ">
      <!-- Event Name -->
      <div style="
        font-size: 20px;
        color: #888;
        text-transform: uppercase;
        letter-spacing: 4px;
        margin-bottom: 16px;
        opacity: \${Math.min(1, sceneProgress * 3)};
      ">\${EVENT.name}</div>

      <div style="
        font-size: 32px;
        color: white;
        margin-bottom: 48px;
        opacity: \${Math.min(1, sceneProgress * 2)};
      ">Coming Soon</div>

      <!-- Countdown Units -->
      <div style="display: flex; gap: 24px;">
        \${units.map((unit, i) => {
          const delay = i * 0.1;
          const opacity = Math.min(1, Math.max(0, (sceneProgress - delay) * 3));
          const scale = 0.8 + opacity * 0.2;
          return \`
            <div style="
              text-align: center;
              opacity: \${opacity};
              transform: scale(\${scale});
            ">
              <div style="
                background: linear-gradient(180deg, #2a2a4a 0%, #1a1a3a 50%, #2a2a4a 100%);
                border-radius: 12px;
                padding: 24px 32px;
                min-width: 100px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.5);
                position: relative;
                overflow: hidden;
              ">
                <!-- Middle line -->
                <div style="
                  position: absolute;
                  left: 0;
                  right: 0;
                  top: 50%;
                  height: 1px;
                  background: rgba(0,0,0,0.3);
                "></div>
                <div style="
                  font-size: 64px;
                  font-weight: 700;
                  color: white;
                  line-height: 1;
                ">\${String(unit.value).padStart(2, '0')}</div>
              </div>
              <div style="
                margin-top: 12px;
                font-size: 12px;
                color: #666;
                letter-spacing: 2px;
              ">\${unit.label}</div>
            </div>
          \`;
        }).join('')}
      </div>

      <!-- Glowing accent -->
      <div style="
        width: 200px;
        height: 4px;
        background: linear-gradient(90deg, transparent, #6366f1, transparent);
        margin-top: 48px;
        opacity: \${0.5 + Math.sin(sceneProgress * Math.PI * 2) * 0.5};
        border-radius: 2px;
      "></div>
    </div>
  \`;
}`;

export const LOGO_ANIMATION = `// Logo Animation
// Brand reveal with glow effect

const BRAND = {
  name: "Acme Inc",
  icon: "◆",
  tagline: "Building the future",
};

export function render(ctx) {
  const { width, height, sceneProgress } = ctx;

  // Animation phases
  const iconPhase = Math.min(1, sceneProgress * 2);
  const textPhase = Math.max(0, Math.min(1, (sceneProgress - 0.3) * 2));
  const taglinePhase = Math.max(0, Math.min(1, (sceneProgress - 0.5) * 2));

  // Glow intensity
  const glowIntensity = 20 + Math.sin(sceneProgress * Math.PI * 3) * 10;

  // Icon rotation
  const rotation = sceneProgress * 360;

  // Particle effect
  const particles = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * Math.PI * 2 + sceneProgress * 2;
    const distance = 80 + Math.sin(sceneProgress * Math.PI * 2 + i) * 20;
    const opacity = iconPhase * (0.3 + Math.sin(sceneProgress * Math.PI * 4 + i) * 0.3);
    return {
      x: width / 2 + Math.cos(angle) * distance * sceneProgress,
      y: height / 2 - 20 + Math.sin(angle) * distance * sceneProgress,
      opacity,
    };
  });

  return \`
    <div style="
      width: \${width}px;
      height: \${height}px;
      background: radial-gradient(circle at center, #1a1a2e 0%, #0a0a15 100%);
      font-family: system-ui, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
    ">
      <!-- Particles -->
      \${particles.map(p => \`
        <div style="
          position: absolute;
          left: \${p.x}px;
          top: \${p.y}px;
          width: 6px;
          height: 6px;
          background: #6366f1;
          border-radius: 50%;
          opacity: \${p.opacity};
          box-shadow: 0 0 10px #6366f1;
        "></div>
      \`).join('')}

      <!-- Logo Icon -->
      <div style="
        font-size: 100px;
        color: #6366f1;
        transform: scale(\${iconPhase}) rotate(\${rotation}deg);
        text-shadow: 0 0 \${glowIntensity}px #6366f1, 0 0 \${glowIntensity * 2}px #6366f1;
        margin-bottom: 24px;
      ">\${BRAND.icon}</div>

      <!-- Brand Name -->
      <div style="
        font-size: 48px;
        font-weight: 700;
        color: white;
        opacity: \${textPhase};
        transform: translateY(\${(1 - textPhase) * 20}px);
        letter-spacing: 4px;
      ">\${BRAND.name}</div>

      <!-- Tagline -->
      <div style="
        font-size: 18px;
        color: #888;
        margin-top: 16px;
        opacity: \${taglinePhase};
        transform: translateY(\${(1 - taglinePhase) * 10}px);
        letter-spacing: 2px;
      ">\${BRAND.tagline}</div>

      <!-- Bottom accent line -->
      <div style="
        width: \${200 * textPhase}px;
        height: 2px;
        background: linear-gradient(90deg, transparent, #6366f1, transparent);
        margin-top: 32px;
      "></div>
    </div>
  \`;
}`;

export const PERSONALIZED_VIDEO = `// Personalized Video
// Dynamic content with variable substitution

// These would be replaced at render time
const USER = {
  name: "{name}",
  company: "{company}",
  plan: "Pro",
};

export function render(ctx) {
  const { width, height, sceneProgress } = ctx;

  // Animation phases
  const welcomePhase = Math.min(1, sceneProgress * 3);
  const namePhase = Math.max(0, Math.min(1, (sceneProgress - 0.2) * 2.5));
  const detailsPhase = Math.max(0, Math.min(1, (sceneProgress - 0.5) * 2));

  return \`
    <div style="
      width: \${width}px;
      height: \${height}px;
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
        opacity: \${welcomePhase};
        transform: translateY(\${(1 - welcomePhase) * 20}px);
      ">Welcome to SuperImg</div>

      <!-- Personalized name -->
      <div style="
        font-size: 64px;
        font-weight: 700;
        background: linear-gradient(90deg, #60a5fa, #a78bfa, #f472b6);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 32px;
        opacity: \${namePhase};
        transform: scale(\${0.9 + namePhase * 0.1});
      ">Hey, \${USER.name}!</div>

      <!-- Details card -->
      <div style="
        background: rgba(255,255,255,0.1);
        backdrop-filter: blur(10px);
        border-radius: 16px;
        padding: 32px 48px;
        text-align: center;
        opacity: \${detailsPhase};
        transform: translateY(\${(1 - detailsPhase) * 20}px);
      ">
        <div style="
          font-size: 18px;
          color: rgba(255,255,255,0.7);
          margin-bottom: 8px;
        ">Your \${USER.plan} plan for</div>
        <div style="
          font-size: 32px;
          font-weight: 600;
          color: white;
        ">\${USER.company}</div>
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
        opacity: \${detailsPhase};
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
  \`;
}`;
