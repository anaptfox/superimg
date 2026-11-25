import type { Metadata } from "next";
import "./globals.css";
import localFont from "next/font/local";
import { ThemeProvider } from "@/components/providers/ThemeProvider";

const ibmPlexSans = localFont({
  src: [
    { path: "./fonts/IBMPlexSans-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/IBMPlexSans-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/IBMPlexSans-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "./fonts/IBMPlexSans-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-ibm-plex-sans",
});
const ibmPlexMono = localFont({
  src: [
    { path: "./fonts/IBMPlexMono-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/IBMPlexMono-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/IBMPlexMono-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "./fonts/IBMPlexMono-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-ibm-plex-mono",
});

export const metadata: Metadata = {
  title: "SuperImg",
  description:
    "Write a media program once — play it live, export it anywhere. TypeScript media for Player embeds and platform-ready video, images, GIF, and SVG.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${ibmPlexSans.variable} ${ibmPlexMono.variable}`} suppressHydrationWarning>
      <body className={`${ibmPlexSans.variable} ${ibmPlexMono.variable}`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
