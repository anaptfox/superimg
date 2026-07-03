import type { TimelineData } from "#/lib/ai/schema";

type PartialTimeline = Partial<TimelineData> & {
  events?: Array<Partial<TimelineData["events"][number]>>;
};

export function StreamingTimeline({
  partial,
  final,
  accentPreview,
}: {
  partial: PartialTimeline;
  final: TimelineData | null;
  accentPreview: string | null;
}) {
  const data = final ?? partial;
  const accent = accentPreview ?? data.accentColor ?? "#667eea";
  const events = data.events ?? [];

  if (!data.title && events.length === 0 && !final) {
    return (
      <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.35)" }}>
        Timeline fields stream in as the model generates structured output…
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: 4,
            background: accent,
            boxShadow: `0 0 12px ${accent}55`,
          }}
        />
        <h3
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 700,
            color: "rgba(255,255,255,0.92)",
          }}
        >
          {data.title ?? "…"}
        </h3>
        {final ? (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#34d399",
              background: "rgba(52,211,153,0.12)",
              padding: "2px 8px",
              borderRadius: 20,
            }}
          >
            validated
          </span>
        ) : (
          <span
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.35)",
            }}
          >
            streaming
          </span>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {events.map((event, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "72px 1fr",
              gap: 12,
              padding: "10px 12px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              animation: "fadeIn 0.3s ease",
            }}
          >
            <span
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: 12,
                fontWeight: 600,
                color: accent,
              }}
            >
              {event?.date ?? "…"}
            </span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.88)" }}>
                {event?.title ?? "…"}
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>
                {event?.description ?? ""}
              </div>
            </div>
          </div>
        ))}
      </div>
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }`}</style>
    </div>
  );
}