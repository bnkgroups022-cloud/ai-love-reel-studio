// Generates the PWA icons in public/icons from one SVG design.
// Run: npm run icons
import { mkdirSync } from "node:fs";
import sharp from "sharp";

const svg = (pad: number) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <radialGradient id="bg" cx="50%" cy="30%" r="80%"><stop offset="0" stop-color="#2a1a0c"/><stop offset="1" stop-color="#0a0908"/></radialGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd98a"/><stop offset="0.5" stop-color="#f2b13c"/><stop offset="1" stop-color="#d98c1f"/></linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <g transform="translate(${pad} ${pad}) scale(${(1024 - pad * 2) / 1024})">
    <rect x="312" y="170" width="400" height="684" rx="56" fill="none" stroke="url(#gold)" stroke-width="28"/>
    <path d="M512 640 C 380 545 350 470 395 425 C 435 385 490 400 512 445 C 534 400 589 385 629 425 C 674 470 644 545 512 640 Z" fill="url(#gold)"/>
    <polygon points="480,250 480,320 540,285" fill="#f2b13c"/>
  </g>
</svg>`;

async function main() {
  mkdirSync("public/icons", { recursive: true });
  await sharp(Buffer.from(svg(0))).resize(192, 192).png().toFile("public/icons/icon-192.png");
  await sharp(Buffer.from(svg(0))).resize(512, 512).png().toFile("public/icons/icon-512.png");
  await sharp(Buffer.from(svg(110))).resize(512, 512).png().toFile("public/icons/icon-maskable-512.png");
  await sharp(Buffer.from(svg(40))).resize(180, 180).png().toFile("public/icons/apple-touch-icon.png");
  await sharp(Buffer.from(svg(0))).resize(48, 48).png().toFile("app/icon.png");
  console.log("Icons written to public/icons");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
