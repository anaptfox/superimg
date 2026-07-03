import type { UIMessage } from "@tanstack/ai-react";
import { ToolApprovalCard } from "#/components/ToolApprovalCard";

export function ChatStream({
  messages,
  onApprove,
  onDeny,
}: {
  messages: UIMessage[];
  onApprove: (approvalId: string) => void;
  onDeny: (approvalId: string) => void;
}) {
  if (messages.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        maxHeight: 220,
        overflowY: "auto",
        padding: "4px 0",
      }}
    >
      {messages.map((message) => (
        <div key={message.id}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 1,
              color: message.role === "user" ? "rgba(255,255,255,0.35)" : "#a78bfa",
              marginBottom: 4,
            }}
          >
            {message.role}
          </div>
          {message.parts.map((part, i) => {
            if (part.type === "text") {
              return (
                <p
                  key={i}
                  style={{
                    margin: 0,
                    fontSize: 13,
                    color: "rgba(255,255,255,0.65)",
                    lineHeight: 1.5,
                  }}
                >
                  {part.content}
                </p>
              );
            }

            if (part.type === "thinking") {
              return (
                <p
                  key={i}
                  style={{
                    margin: "4px 0",
                    fontSize: 12,
                    fontStyle: "italic",
                    color: "rgba(255,255,255,0.35)",
                  }}
                >
                  {part.content}
                </p>
              );
            }

            if (
              part.type === "tool-call" &&
              part.state === "approval-requested" &&
              part.approval
            ) {
              return (
                <ToolApprovalCard
                  key={i}
                  part={part}
                  onApprove={() => onApprove(part.approval!.id)}
                  onDeny={() => onDeny(part.approval!.id)}
                />
              );
            }

            if (part.type === "tool-call") {
              return (
                <div
                  key={i}
                  style={{
                    fontSize: 12,
                    color: "rgba(255,255,255,0.45)",
                    padding: "6px 10px",
                    borderRadius: 6,
                    background: "rgba(255,255,255,0.04)",
                  }}
                >
                  <span style={{ color: "#67e8f9" }}>tool</span> {part.name}
                  {part.state ? ` · ${part.state}` : ""}
                </div>
              );
            }

            return null;
          })}
        </div>
      ))}
    </div>
  );
}