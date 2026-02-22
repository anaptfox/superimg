"use client";

import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";

const HERO_CODE = `import { defineTemplate } from 'superimg'

export const introTemplate = defineTemplate({
  config: {
    fps: 30,
    durationSeconds: 4,
    width: 640,
    height: 360,
  },
  render(ctx) {
    const { sceneProgress: p, std, width, height } = ctx

    // Shifting gradient hue
    const hue = 260 + p * 40

    // Text fade in
    const textProgress = std.math.clamp(p / 0.4, 0, 1)
    const textOpacity = std.easing.easeOutCubic(textProgress)

    return \`
      <div style="
        width: \${width}px;
        height: \${height}px;
        background: linear-gradient(135deg,
          hsl(\${hue}, 65%, 18%),
          hsl(\${hue + 40}, 70%, 10%));
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="opacity: \${textOpacity}">
          This video was made with 100% code
        </div>
      </div>
    \`
  },
})`;

export function HeroCode() {
  return (
    <div className="h-[360px] w-[640px] overflow-hidden rounded-xl">
      <CodeMirror
        value={HERO_CODE}
        height="360px"
        theme={oneDark}
        extensions={[javascript({ typescript: true })]}
        readOnly
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          highlightActiveLine: false,
        }}
        className="text-sm"
      />
    </div>
  );
}
