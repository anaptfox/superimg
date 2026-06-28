import { define } from "superimg";

export default define({
  duration: "2s",
  fps: 30,
  width: 1280,
  height: 720,
  mode: "animation",
  render() {
    return `
      <style>
        body { margin: 0; background: #0f0f1a; display: flex; align-items: center; justify-content: center; height: 100vh; }
        .box {
          width: 120px;
          height: 120px;
          background: linear-gradient(135deg, #6366f1, #a855f7);
          border-radius: 16px;
          animation: spin-slide 2s ease-in-out forwards;
        }
        @keyframes spin-slide {
          0%   { transform: translateX(-400px) rotate(0deg); opacity: 0; }
          40%  { opacity: 1; }
          100% { transform: translateX(0) rotate(360deg); opacity: 1; }
        }
      </style>
      <div class="box"></div>
    `;
  },
});
