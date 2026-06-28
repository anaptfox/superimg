import type { Metadata } from "next";
import "./globals.css";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/providers/ThemeProvider";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: "--font-ibm-plex-sans",
});
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: "--font-ibm-plex-mono",
});

export const metadata: Metadata = {
  title: "SuperImg",
  description: "Programmatic media generation — TypeScript templates to MP4, GIF, images, and SVG",
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
