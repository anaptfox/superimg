import { useRef } from "react";
import { Player, type PlayerRef } from "superimg-react";
import { defineTemplate } from "superimg";

// =============================================================================
// TEMPLATE MODULES
// =============================================================================

// Gradient rotation template
const gradientTemplate = defineTemplate({
  config: { width: 640, height: 360, fps: 24, durationSeconds: 2 },
  render(ctx) {
    const { sceneProgress: progress } = ctx;
    const hue = Math.floor(progress * 360);
    return `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-family:system-ui;font-size:32px;color:white;background:linear-gradient(120deg, hsl(${hue}, 80%, 40%), #0f0f0f)">Gradient ${(progress * 100).toFixed(0)}%</div>`;
  },
});

// Pulse animation template
const pulseTemplate = defineTemplate({
  config: { width: 640, height: 360, fps: 24, durationSeconds: 2 },
  render(ctx) {
    const { sceneProgress: progress } = ctx;
    const scale = 0.8 + Math.sin(progress * Math.PI * 4) * 0.2;
    return `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#1a1a2e"><div style="width:80px;height:80px;border-radius:50%;background:#16213e;transform:scale(${scale});box-shadow:0 0 40px rgba(0,149,255,0.8)"></div></div>`;
  },
});

// Color bars template
const barsTemplate = defineTemplate({
  config: { width: 640, height: 360, fps: 24, durationSeconds: 2 },
  render(ctx) {
    const { sceneProgress: progress } = ctx;
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'];
    const bars = colors.map((c, i) => {
      const height = 20 + Math.sin(progress * Math.PI * 2 + i) * 60;
      return `<div style="flex:1;background:${c};height:${height}%"></div>`;
    }).join('');
    return `<div style="width:100%;height:100%;display:flex;align-items:flex-end;background:#0f0f0f">${bars}</div>`;
  },
});

// Spinning squares template
const spinTemplate = defineTemplate({
  config: { width: 640, height: 360, fps: 24, durationSeconds: 2 },
  render(ctx) {
    const { sceneProgress: progress } = ctx;
    const rotate = progress * 360;
    return `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg, #667eea 0%, #764ba2 100%)"><div style="width:60px;height:60px;background:white;transform:rotate(${rotate}deg)"></div></div>`;
  },
});

// Wave pattern template
const waveTemplate = defineTemplate({
  config: { width: 640, height: 360, fps: 24, durationSeconds: 2 },
  render(ctx) {
    const { sceneProgress: progress } = ctx;
    return `<div style="width:100%;height:100%;background:#0a0e27;display:flex;align-items:center;justify-content:center;font-size:24px;color:#64ffda">◆ ◇ ◆ ◇<br>Wave ${Math.floor(progress * 100)}%</div>`;
  },
});

// Gradient sweep template
const sweepTemplate = defineTemplate({
  config: { width: 640, height: 360, fps: 24, durationSeconds: 2 },
  render(ctx) {
    const { sceneProgress: progress } = ctx;
    const angle = progress * 360;
    return `<div style="width:100%;height:100%;background:linear-gradient(${angle}deg, #ee0979 0%, #ff6a00 100%);display:flex;align-items:center;justify-content:center;font-size:28px;color:white;font-weight:bold">SWEEP</div>`;
  },
});

const templates = [gradientTemplate, pulseTemplate, barsTemplate, spinTemplate, waveTemplate, sweepTemplate];

// =============================================================================
// VIDEO DATA
// =============================================================================

const videos = [
  { id: 1, title: "Amazing Gradient Animation", channel: "SuperImg Channel", views: "1.2M views", avatar: "🎬", template: 0 },
  { id: 2, title: "Colorful Preview Demo", channel: "Design Studio", views: "856K views", avatar: "🎨", template: 2 },
  { id: 3, title: "Smooth Transitions Tutorial", channel: "Web Dev Tips", views: "432K views", avatar: "💻", template: 3 },
  { id: 4, title: "Canvas Rendering Explained", channel: "Tech Talks", views: "234K views", avatar: "⚡", template: 1 },
  { id: 5, title: "Interactive Video Previews", channel: "UI Showcase", views: "678K views", avatar: "✨", template: 4 },
  { id: 6, title: "Performance Optimization Guide", channel: "Code Reviews", views: "345K views", avatar: "🚀", template: 5 },
  { id: 7, title: "Modern Web Animations", channel: "Frontend Weekly", views: "567K views", avatar: "🎯", template: 0 },
  { id: 8, title: "Browser Canvas API Deep Dive", channel: "Dev Insights", views: "123K views", avatar: "🔍", template: 2 },
  { id: 9, title: "Real-time Video Generation", channel: "Innovation Lab", views: "890K views", avatar: "💡", template: 1 },
  { id: 10, title: "WebGL vs Canvas Comparison", channel: "Graphics Pro", views: "456K views", avatar: "🎪", template: 3 },
  { id: 11, title: "Frame-by-Frame Animation", channel: "Animation Hub", views: "789K views", avatar: "🎭", template: 4 },
  { id: 12, title: "Optimized Rendering Pipeline", channel: "Performance Gurus", views: "234K views", avatar: "⚙️", template: 5 },
];

// =============================================================================
// APP COMPONENT
// =============================================================================

function App() {
  const playerRefs = useRef<Map<number, PlayerRef>>(new Map());

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", background: "#0f0f0f", color: "#f1f1f1", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{
        background: "#0f0f0f",
        padding: "0 16px",
        height: "56px",
        display: "flex",
        alignItems: "center",
        borderBottom: "1px solid #272727",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}>
        <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 400 }}>SuperImg React Player</h1>
      </div>

      {/* Container */}
      <div style={{ maxWidth: "100%", padding: "24px 16px" }}>
        {/* Grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: "40px 16px",
        }}>
          {videos.map((video) => (
            <div
              key={video.id}
              style={{
                cursor: "pointer",
                width: "100%",
              }}
            >
              {/* Thumbnail Container */}
              <div style={{
                position: "relative",
                width: "100%",
                aspectRatio: "16 / 9",
                background: "#181818",
                borderRadius: "12px",
                overflow: "hidden",
                marginBottom: "12px",
              }}>
                <Player
                  ref={(ref) => {
                    if (ref) {
                      playerRefs.current.set(video.id, ref);
                    } else {
                      playerRefs.current.delete(video.id);
                    }
                  }}
                  template={templates[video.template]}
                  width={320}
                  height={180}
                  playbackMode="loop"
                  loadMode="lazy"
                  hoverBehavior="play"
                  hoverDelayMs={200}
                  maxCacheFrames={30}
                  style={{ width: "100%", height: "100%" }}
                  onLoad={(result) => {
                    if (result.status === "success") {
                      console.log(`Player ${video.id} ready: ${result.totalFrames} frames`);
                    }
                  }}
                />
              </div>

              {/* Video Info */}
              <div style={{ display: "flex", gap: "12px", paddingRight: "24px" }}>
                <div style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: "#272727",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "16px",
                  color: "#aaa",
                }}>
                  {video.avatar}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{
                    fontSize: "16px",
                    fontWeight: 500,
                    lineHeight: "22px",
                    margin: "0 0 4px 0",
                    color: "#f1f1f1",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}>
                    {video.title}
                  </h3>
                  <p style={{
                    fontSize: "14px",
                    color: "#aaa",
                    margin: "0 0 2px 0",
                  }}>
                    {video.channel}
                  </p>
                  <p style={{
                    fontSize: "14px",
                    color: "#aaa",
                    margin: 0,
                  }}>
                    {video.views}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Demo Section - Basic Player with Controls */}
        <div style={{ marginTop: "60px", padding: "24px", background: "#181818", borderRadius: "12px" }}>
          <h2 style={{ marginTop: 0, marginBottom: "24px" }}>Basic Player with Built-in Controls</h2>
          <div style={{ maxWidth: "640px" }}>
            <Player
              template={gradientTemplate}
              width={640}
              height={360}
              playbackMode="loop"
              loadMode="eager"
              controls
              style={{ borderRadius: "8px", overflow: "hidden" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
