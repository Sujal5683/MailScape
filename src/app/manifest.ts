import type { MetadataRoute } from "next";

// Next.js App Router convention: a `manifest.ts` (or `manifest.tsx`) file at the
// root of the `app` directory is automatically served at `/manifest.webmanifest`.
// This is referenced from the root layout's `metadata.manifest` field.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mail Intelligence — Institutional Email Command Center",
    short_name: "Mail Intelligence",
    description:
      "An organized, searchable, actionable command center for institutional Gmail.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    background_color: "#ffffff",
    // Neutral dark-slate theme color — works in both light & dark mode and
    // avoids the project's "no indigo/blue" restriction (slate is neutral).
    theme_color: "#1e293b",
    orientation: "any",
    categories: ["productivity", "business", "utilities"],
    lang: "en",
    dir: "ltr",
    prefer_related_applications: false,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    shortcuts: [
      {
        name: "Inbox",
        short_name: "Inbox",
        url: "/?view=inbox",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "AI Assistant",
        short_name: "Assistant",
        url: "/?view=assistant",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Compose",
        short_name: "Compose",
        url: "/?view=compose",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
