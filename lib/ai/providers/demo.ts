import "server-only";
import sharp from "sharp";
import type { GenerateImageInput, GeneratedImage, ImageProvider } from "../image-provider";

// DEMO MODE placeholder images. No AI is called. Every image is a flat
// gradient card with a large "DEMO MODE — NOT AI GENERATED" label so it can
// never be mistaken for a real generated image.

const PALETTES = [
  ["#1b1030", "#6b3b12"],
  ["#10202e", "#5a3a70"],
  ["#221410", "#8a5a1a"],
  ["#0e1a24", "#3d5a6e"],
  ["#1e0f1a", "#7a2f4a"],
  ["#141a10", "#5e6a24"],
  ["#1a1424", "#a0703a"],
  ["#20100c", "#c08a3e"],
];

function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
}

function wrap(text: string, width: number, maxLines: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > width) {
      lines.push(line.trim());
      line = w;
      if (lines.length === maxLines) break;
    } else line += " " + w;
  }
  if (lines.length < maxLines && line.trim()) lines.push(line.trim());
  return lines;
}

export async function renderDemoImage(sceneNumber: number, description: string): Promise<Buffer> {
  const [a, b] = PALETTES[(sceneNumber - 1) % PALETTES.length];
  const lines = wrap(description.replace(/[^\x20-\x7E]/g, " "), 30, 5);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
  <rect width="1080" height="1920" fill="url(#g)"/>
  <circle cx="780" cy="560" r="260" fill="#ffffff" opacity="0.06"/>
  <circle cx="300" cy="1300" r="340" fill="#ffffff" opacity="0.04"/>
  <rect x="60" y="120" width="960" height="190" rx="24" fill="#000000" opacity="0.55"/>
  <text x="540" y="210" font-family="Arial, Helvetica, sans-serif" font-size="72" font-weight="700" fill="#f5b041" text-anchor="middle">DEMO MODE</text>
  <text x="540" y="275" font-family="Arial, Helvetica, sans-serif" font-size="38" fill="#ffffff" text-anchor="middle">Placeholder — NOT AI generated</text>
  <text x="540" y="900" font-family="Georgia, serif" font-size="150" fill="#ffffff" opacity="0.9" text-anchor="middle">Scene ${sceneNumber}</text>
  ${lines
    .map((l, i) => `<text x="540" y="${1040 + i * 64}" font-family="Arial, Helvetica, sans-serif" font-size="46" fill="#ffffff" opacity="0.85" text-anchor="middle">${escapeXml(l)}</text>`)
    .join("\n  ")}
</svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toBuffer();
}

export function createDemoProvider(): ImageProvider {
  return {
    name: "demo",
    isDemo: true,
    async generateImage(input: GenerateImageInput): Promise<GeneratedImage> {
      const label = input.demoLabel ?? { sceneNumber: 0, description: "" };
      const data = await renderDemoImage(label.sceneNumber, label.description);
      return { provider: "demo", assetUrl: null, providerAssetId: null, data, mimeType: "image/jpeg" };
    },
  };
}
