"use client";

import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";

const HERO_CODE = `import { defineTemplate } from 'superimg'

export default defineTemplate({
  defaults: {
    title: 'This video was made with',
    highlight: '100% code',
    accentColor: '#a78bfa',
  },
  config: {
    fps: 30,
    durationSeconds: 4,
    width: 640,
    height: 360,
  },
  render(ctx) {
    const { sceneProgress: p, std, width, height, data } = ctx

    // Shifting gradient hue
    const hue = 260 + p * 40

    // Text fade in
    const textProgress = std.math.clamp(p / 0.4, 0, 1)
    const opacity = std.tween(0, 1, textProgress, 'easeOutCubic')

    return \`
      <div style="\${std.css({
        width, height,
        background: \`linear-gradient(135deg,
          hsl(\${hue},65%,18%), hsl(\${hue+40},70%,10%))\`,
      })};\${std.css.center()}">
        <div style="\${std.css({ opacity, textAlign: 'center',
            fontFamily: 'system-ui, sans-serif', color: 'white' })}">
          <div style="font-size:24px">\${data.title}</div>
          <div style="font-size:40px;font-weight:800;
            color:\${data.accentColor}">\${data.highlight}</div>
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
