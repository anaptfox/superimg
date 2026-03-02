import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Video Generator — SuperImg",
  description:
    "Type a topic, get a video. AI-generated data rendered in real-time with SuperImg.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: 0,
          background: "#09090b",
          color: "#fafafa",
          fontFamily: "system-ui, -apple-system, sans-serif",
          minHeight: "100vh",
        }}
      >
        {children}
      </body>
    </html>
  );
}
