import { defineTemplate, type RenderContext } from 'superimg'

export const introTemplate = defineTemplate({
  config: {
    fps: 30,
    durationSeconds: 4,
    width: 640,
    height: 360,
  },
  render(ctx: RenderContext) {
    const { sceneProgress: p, std, width, height } = ctx

    // Shifting gradient hue
    const hue = 260 + p * 40

    // Text fade in
    const textProgress = std.math.clamp(p / 0.4, 0, 1)
    const textOpacity = std.easing.easeOutCubic(textProgress)
    const textY = std.math.lerp(20, 0, std.easing.easeOutCubic(textProgress))

    // Subtle pulsing glow
    const glowOpacity = 0.25 + Math.sin(p * Math.PI * 3) * 0.1
    const glowScale = 0.95 + Math.sin(p * Math.PI * 2) * 0.05

    return `
      <style>* { margin:0; padding:0; box-sizing:border-box; }</style>
      <div style="
        width:${width}px;
        height:${height}px;
        background:linear-gradient(135deg, hsl(${hue},65%,18%) 0%, hsl(${hue + 40},70%,10%) 100%);
        display:flex;
        align-items:center;
        justify-content:center;
        font-family:system-ui,-apple-system,sans-serif;
        position:relative;
        overflow:hidden;
      ">
        <!-- Glow effect -->
        <div style="
          position:absolute;
          width:400px;
          height:400px;
          background:radial-gradient(circle, rgba(139,92,246,${glowOpacity}) 0%, transparent 60%);
          top:50%;
          left:50%;
          transform:translate(-50%,-50%) scale(${glowScale});
        "></div>

        <!-- Main text -->
        <div style="
          text-align:center;
          position:relative;
          z-index:1;
          opacity:${textOpacity};
          transform:translateY(${textY}px);
        ">
          <div style="
            font-size:32px;
            font-weight:700;
            color:white;
            text-shadow:0 4px 20px rgba(0,0,0,0.3);
            letter-spacing:-0.5px;
          ">This video was made with</div>
          <div style="
            font-size:48px;
            font-weight:800;
            background:linear-gradient(90deg, #60a5fa, #a78bfa);
            -webkit-background-clip:text;
            -webkit-text-fill-color:transparent;
            background-clip:text;
            margin-top:8px;
            letter-spacing:-1px;
          ">100% code</div>
        </div>
      </div>
    `
  },
})
