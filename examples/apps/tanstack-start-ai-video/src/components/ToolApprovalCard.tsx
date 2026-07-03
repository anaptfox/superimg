import type { MessagePart } from "@tanstack/ai-client";

type ToolCallPart = Extract<MessagePart, { type: "tool-call" }>;

export function ToolApprovalCard({
  part,
  onApprove,
  onDeny,
}: {
  part: ToolCallPart;
  onApprove: () => void;
  onDeny: () => void;
}) {
  const input = part.input ?? (part.arguments ? safeParse(part.arguments) : null);

  return (
    <div
      style={{
        padding: "14px 16px",
        borderRadius: 10,
        border: "1px solid rgba(250,204,21,0.35)",
        background: "rgba(250,204,21,0.08)",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: "#fde68a" }}>
        Approval required: {part.name}
      </div>
      {input && (
        <pre
          style={{
            margin: "0 0 12px",
            padding: 10,
            fontSize: 11,
            borderRadius: 6,
            background: "rgba(0,0,0,0.35)",
            color: "rgba(255,255,255,0.7)",
            overflow: "auto",
          }}
        >
          {JSON.stringify(input, null, 2)}
        </pre>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={onApprove}
          style={{
            padding: "6px 14px",
            fontSize: 12,
            fontWeight: 600,
            border: "none",
            borderRadius: 6,
            background: "#22c55e",
            color: "#052e16",
            cursor: "pointer",
          }}
        >
          Approve
        </button>
        <button
          type="button"
          onClick={onDeny}
          style={{
            padding: "6px 14px",
            fontSize: 12,
            fontWeight: 600,
            border: "none",
            borderRadius: 6,
            background: "rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.8)",
            cursor: "pointer",
          }}
        >
          Deny
        </button>
      </div>
    </div>
  );
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}