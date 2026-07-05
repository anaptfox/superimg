import { define } from "superimg";

export default define({
  config: {
    width: 1280,
    height: 720,
    fps: 30,
    duration: "2s",
  },
  render(ctx) {
    // CSS keyframes drive the motion; each frame scrubs the paused animation
    // to the current timeline position via a negative animation-delay, so the
    // render stays a pure function of time.
    const t = ctx.timeline.seconds;
    return `
      <style>
        .stage { width: 1280px; height: 720px; background: #0f0f1a; display: flex; align-items: center; justify-content: center; }
        .box {
          width: 120px;
          height: 120px;
          background: linear-gradient(135deg, #6366f1, #a855f7);
          border-radius: 16px;
          animation: spin-slide 2s ease-in-out forwards;
          animation-play-state: paused;
          animation-delay: -${t.toFixed(4)}s;
        }
        @keyframes spin-slide {
          0%   { transform: translateX(-400px) rotate(0deg); opacity: 0; }
          40%  { opacity: 1; }
          70%  { transform: translateX(0) rotate(360deg); opacity: 1; }
          100% { transform: translateX(0) rotate(360deg); opacity: 1; }
        }
      </style>
      <div class="stage"><div class="box"></div></div>
    `;
  },
});
