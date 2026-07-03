import type { ReactNode } from "react";
import { HeadContent, Scripts, createRootRoute, Outlet } from "@tanstack/react-router";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      {
        title: "AI Video Generator — SuperImg × TanStack AI",
      },
      {
        name: "description",
        content:
          "Type a topic, get a video. AI-generated data rendered in real-time with SuperImg.",
      },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
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
        <Scripts />
      </body>
    </html>
  );
}