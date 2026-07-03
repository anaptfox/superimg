"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Player, type PlayerInput } from "superimg/react";
import { gradientTemplate, helloTemplate, pulseTemplate } from "../lib/templates";

type Demo = {
  id: string;
  title: string;
  template: PlayerInput;
  controls?: boolean;
  hover?: boolean;
};

const demos: Demo[] = [
  { id: "hello", title: "Hello card", template: helloTemplate, controls: true },
  { id: "pulse", title: "Pulse loop", template: pulseTemplate, hover: true },
  { id: "gradient", title: "Gradient sweep", template: gradientTemplate, hover: true },
];

/**
 * The SuperImg `<Player>` uses the rolldown-WASM browser bundler and DOM APIs.
 * Even inside a `"use client"` component, Waku still server-renders the markup,
 * so we gate the player behind a mounted-state guard — it renders a fallback
 * during SSR and the real player only after hydration in the browser.
 */
function ClientOnly({
  children,
  fallback = null,
}: {
  children: () => ReactNode;
  fallback?: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return <>{mounted ? children() : fallback}</>;
}

export function PlayerGallery() {
  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "40px 24px" }}>
      <h1 style={{ margin: "0 0 8px", fontSize: 32, fontWeight: 800, letterSpacing: "-1px" }}>
        Waku RSC
      </h1>
      <p style={{ margin: "0 0 32px", color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
        Server component renders the page; this gallery is a{" "}
        <code style={{ color: "#93c5fd" }}>"use client"</code> island. The{" "}
        <code style={{ color: "#93c5fd" }}>Player</code> from{" "}
        <code style={{ color: "#93c5fd" }}>superimg/react</code> is mounted client-only so the WASM
        bundler never runs during SSR.
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
              <ClientOnly
                fallback={
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "rgba(255,255,255,0.3)",
                      fontSize: 13,
                    }}
                  >
                    Loading preview…
                  </div>
                }
              >
                {() => (
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
                )}
              </ClientOnly>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
