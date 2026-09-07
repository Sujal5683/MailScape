import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mail Intelligence — Institutional Email Command Center",
  description:
    "An organized, searchable, actionable command center for institutional Gmail. Deterministic rules, sender intelligence, AI assistant, grouped notifications, and analytics.",
  keywords: [
    "email", "Gmail", "institutional", "AI assistant", "rules", "dashboard",
  ],
  authors: [{ name: "Mail Intelligence" }],
  // PWA — Next.js App Router serves `src/app/manifest.ts` at this path.
  manifest: "/manifest.webmanifest",
  applicationName: "Mail Intelligence",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Mail Intelligence",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192" }],
    shortcut: ["/logo.svg"],
  },
};

// PWA / mobile — `viewport-fit: cover` enables safe-area insets (notches,
// home indicators) so the sticky footer + app shell respect device chrome.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#1e293b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
