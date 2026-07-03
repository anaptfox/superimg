import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blog to Video — SuperImg",
  description: "Paste a blog URL, preview a karaoke read-along, and export MP4.",
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