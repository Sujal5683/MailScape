/**
 * PWA icon generator.
 *
 * Converts the single source `public/icon.svg` into the raster PNG icons
 * referenced by `src/app/manifest.ts`:
 *   - public/icon-192.png           (any, 192×192)
 *   - public/icon-512.png           (any, 512×512)
 *   - public/icon-512-maskable.png  (maskable, 512×512 — full-bleed bg + safe-zone content)
 *
 * Run with:  bun run src/scripts/generate-icons.ts
 *
 * Uses `sharp` (already a project dependency) for crisp SVG → PNG rasterization.
 */
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..", "..");
const SVG_PATH = resolve(ROOT, "public", "icon.svg");

async function main() {
  const svg = readFileSync(SVG_PATH);

  // 192×192 — standard "any" icon (home-screen / favicon-grade).
  await sharp(svg, { density: 384 }).resize(192, 192).png().toFile(
    resolve(ROOT, "public", "icon-192.png"),
  );

  // 512×512 — high-res "any" icon (splash / install prompt).
  await sharp(svg, { density: 512 }).resize(512, 512).png().toFile(
    resolve(ROOT, "public", "icon-512.png"),
  );

  // 512×512 maskable — the source SVG already has a full-bleed background and
  // keeps the envelope within the maskable safe zone (inner 80%), so the same
  // artwork works. We re-rasterize explicitly (fit: contain) so the output is
  // guaranteed to be a full 512×512 with no transparent edges.
  await sharp(svg, { density: 512 })
    .resize(512, 512, { fit: "contain", background: "#ffffff" })
    .png()
    .toFile(resolve(ROOT, "public", "icon-512-maskable.png"));

  console.log("✓ PWA icons generated:");
  console.log("  public/icon-192.png");
  console.log("  public/icon-512.png");
  console.log("  public/icon-512-maskable.png");
}

main().catch((err) => {
  console.error("Icon generation failed:", err);
  process.exit(1);
});
