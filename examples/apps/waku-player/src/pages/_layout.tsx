import "../styles.css";

import type { ReactNode } from "react";

type RootLayoutProps = { children: ReactNode };

export default async function RootLayout({ children }: RootLayoutProps) {
  return (
    <div style={{ minHeight: "100svh" }}>
      <meta name="description" content="SuperImg <Player> previews in a Waku RSC app" />
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
          SuperImg <span style={{ color: "rgba(255,255,255,0.35)", fontWeight: 400 }}>× Waku</span>
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
      <main>{children}</main>
    </div>
  );
}

export const getConfig = async () => {
  return {
    render: "static",
  } as const;
};
