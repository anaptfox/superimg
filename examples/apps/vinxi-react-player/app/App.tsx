import { Player } from "superimg/react";
import {
  gradientTemplate,
  helloTemplate,
  pulseTemplate,
} from "./lib/templates";

const demos = [
  { id: "hello", title: "Hello card", template: helloTemplate, controls: true },
  { id: "pulse", title: "Pulse loop", template: pulseTemplate, hover: true },
  { id: "gradient", title: "Gradient sweep", template: gradientTemplate, hover: true },
] as const;

export default function App() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#09090b",
        color: "#fafafa",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <header
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          padding: "0 24px",
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 18 }}>
          SuperImg <span style={{ color: "rgba(255,255,255,0.35)", fontWeight: 400 }}>× Vinxi</span>
        </span>
        <a
          href="https://github.com/anaptfox/superimg"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, textDecoration: "none" }}
        >
          GitHub →
        </a>
      </header>

      <main style={{ maxWidth: 960, margin: "0 auto", padding: "40px 24px" }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 32, fontWeight: 800, letterSpacing: "-1px" }}>
          Vinxi React SPA
        </h1>
        <p style={{ margin: "0 0 32px", color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
          Client-only Vinxi router + <code style={{ color: "#a5b4fc" }}>superimg/react</code> preview.
          No framework plugin — import <code style={{ color: "#a5b4fc" }}>Player</code> in your client entry.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 24,
          }}
        >
          {demos.map((demo) => (
            <div key={demo.id}>
              <p style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 600 }}>{demo.title}</p>
              <div
                style={{
                  aspectRatio: "16 / 9",
                  borderRadius: 12,
                  overflow: "hidden",
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "#0a0a14",
                }}
              >
                <Player
                  template={demo.template}
                  format="horizontal"
                  playbackMode="loop"
                  loadMode={demo.hover ? "lazy" : "eager"}
                  hoverBehavior={demo.hover ? "play" : "none"}
                  hoverDelayMs={200}
                  controls={demo.controls}
                  style={{ width: "100%", height: "100%" }}
                />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}