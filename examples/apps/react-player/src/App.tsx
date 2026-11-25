import { useRef } from "react";
import { Player, type PlayerRef } from "@foxworth/superimg/react/player";
import preview, { previews } from "../../_shared/preview.media";

export default function App() {
  const refs = useRef<(PlayerRef | null)[]>([]);

  return (
    <div style={{ padding: 24, fontFamily: "system-ui", background: "#0a0a0a", minHeight: "100vh" }}>
      <h1 style={{ color: "#fff", marginBottom: 8 }}>SuperImg React Player</h1>
      <p style={{ color: "#888", marginBottom: 24 }}>
        Hover or focus a card to preview the same media in React.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        {previews.map((data, i) => (
          <div
            key={data.kind}
            tabIndex={0}
            aria-label={`${data.title} preview`}
            onFocus={() => refs.current[i]?.play()}
            onBlur={() => { refs.current[i]?.pause(); void refs.current[i]?.seek({ frame: 0 }); }}
            style={{
              borderRadius: 12,
              overflow: "hidden",
              border: "1px solid #222",
              background: "#111",
            }}
          >
            <Player
              ref={(r) => { refs.current[i] = r; }}
              media={preview} data={data} size={{ width: 640, height: 360 }}
              playbackMode="loop" loadMode="lazy" hoverBehavior="play" hoverDelayMs={150}
              style={{ width: "100%", aspectRatio: "16/9" }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
