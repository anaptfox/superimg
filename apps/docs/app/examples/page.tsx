//! Examples - Reels-style showcase of SuperImg templates
//! Swipe through examples and open them in the playground

"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import {
  ReelsPlayer,
  type ReelsPlayerRef,
  type ReelItemData,
} from "@/components/reels";
import {
  EDITOR_EXAMPLES,
  EXAMPLE_CATEGORIES,
} from "@/lib/video/examples/index";
import { useIsMobile } from "@/hooks/use-mobile";
import { ArrowRight, ArrowLeft, Monitor, Smartphone, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormatOption } from "superimg/browser";

// Convert editor examples to reel items
const exampleReels: ReelItemData[] = EDITOR_EXAMPLES.map((example) => ({
  id: example.id,
  code: example.code,
  title: example.title,
  category: example.category,
  categoryTitle:
    EXAMPLE_CATEGORIES.find((c) => c.id === example.category)?.title ??
    example.category,
}));

type FormatType = "vertical" | "horizontal" | "square";

const FORMAT_OPTIONS: { id: FormatType; label: string; icon: typeof Monitor }[] = [
  { id: "vertical", label: "9:16", icon: Smartphone },
  { id: "horizontal", label: "16:9", icon: Monitor },
  { id: "square", label: "1:1", icon: Square },
];

export default function ExamplesPage() {
  const reelsRef = useRef<ReelsPlayerRef>(null);
  const [format, setFormat] = useState<FormatType>("vertical");
  const isMobile = useIsMobile();
  const router = useRouter();

  // Escape key to navigate home
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        router.push("/");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  // Map format type to FormatOption
  const formatOption: FormatOption =
    format === "vertical"
      ? "vertical"
      : format === "horizontal"
        ? "horizontal"
        : "square";

  return (
    <div style={{ width: "100vw", height: "100dvh", overflow: "hidden" }}>
      <ReelsPlayer
        ref={reelsRef}
        items={exampleReels}
        preloadCount={1}
        keyboardNavigation
        format={formatOption}
        showIndicators
        renderOverlay={(item, index, isActive) => (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              pointerEvents: "none",
            }}
          >
            {/* Top bar with logo and format toggle */}
            <div
              style={{
                padding: "48px 20px 16px",
                background: "linear-gradient(rgba(0,0,0,0.6), transparent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                pointerEvents: "auto",
              }}
            >
              <Link
                href="/"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  color: "white",
                  fontWeight: 600,
                  fontSize: "16px",
                  textDecoration: "none",
                  fontFamily: "system-ui, -apple-system, sans-serif",
                }}
              >
                <ArrowLeft size={16} />
                SuperImg
              </Link>

              {/* Format toggle - desktop only */}
              {!isMobile && (
                <div
                  style={{
                    display: "flex",
                    gap: "4px",
                    padding: "4px",
                    background: "rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  {FORMAT_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const isSelected = format === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setFormat(opt.id);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "6px 12px",
                          border: "none",
                          borderRadius: "6px",
                          background: isSelected
                            ? "rgba(255,255,255,0.2)"
                            : "transparent",
                          color: isSelected
                            ? "white"
                            : "rgba(255,255,255,0.6)",
                          fontSize: "12px",
                          fontWeight: 500,
                          cursor: "pointer",
                          transition: "all 0.2s",
                          fontFamily: "system-ui, -apple-system, sans-serif",
                        }}
                      >
                        <Icon size={14} />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              )}

              <div
                style={{
                  color: "rgba(255,255,255,0.7)",
                  fontSize: "14px",
                  fontFamily: "system-ui, -apple-system, sans-serif",
                }}
              >
                {index + 1} / {exampleReels.length}
              </div>
            </div>

            {/* Bottom info */}
            <div
              style={{
                padding: "24px 20px",
                paddingBottom: "max(24px, env(safe-area-inset-bottom))",
                background: "linear-gradient(transparent, rgba(0,0,0,0.8))",
                pointerEvents: "auto",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  color: "rgba(255,255,255,0.6)",
                  marginBottom: "6px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  fontFamily: "system-ui, -apple-system, sans-serif",
                }}
              >
                {item.categoryTitle as string}
              </div>
              <div
                style={{
                  fontSize: "22px",
                  fontWeight: 600,
                  color: "white",
                  marginBottom: "16px",
                  fontFamily: "system-ui, -apple-system, sans-serif",
                }}
              >
                {item.title as string}
              </div>

              <Link
                href={`/playground?example=${item.id}`}
                onClick={(e) => e.stopPropagation()}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "12px 20px",
                  background: "rgba(255,255,255,0.15)",
                  backdropFilter: "blur(8px)",
                  borderRadius: "8px",
                  color: "white",
                  fontSize: "14px",
                  fontWeight: 500,
                  textDecoration: "none",
                  transition: "background 0.2s",
                  fontFamily: "system-ui, -apple-system, sans-serif",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.25)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.15)";
                }}
              >
                View Code
                <ArrowRight size={16} />
              </Link>

              <div
                style={{
                  marginTop: "16px",
                  fontSize: "12px",
                  color: "rgba(255,255,255,0.5)",
                  fontFamily: "system-ui, -apple-system, sans-serif",
                }}
              >
                {isMobile
                  ? "Swipe up/down to browse"
                  : "Use ← → arrow keys or scroll to browse"}
              </div>
            </div>
          </div>
        )}
      />
    </div>
  );
}
