import "server-only";
import path from "node:path";
import sharp from "sharp";

// Renders a scene's short text line into a transparent full-frame PNG that
// renderers place on top of the image. Uses the bundled Hind font (SIL Open
// Font License), which covers both Devanagari (Hindi) and Latin letters.

export const OVERLAY_FONT = path.join(process.cwd(), "public", "fonts", "Hind-SemiBold.ttf");

function escapeMarkup(s: string) {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
}

export async function renderTextOverlay(text: string, width = 1080, height = 1920): Promise<Buffer> {
  const safe = escapeMarkup(text.trim());
  const fontSize = Math.round(width * 0.062);
  const textWidth = Math.round(width * 0.84);

  const makeText = (color: string) =>
    sharp({
      text: {
        text: `<span foreground="${color}">${safe}</span>`,
        font: `Hind SemiBold ${fontSize}`,
        fontfile: OVERLAY_FONT,
        width: textWidth,
        align: "centre",
        rgba: true,
        dpi: 72,
        wrap: "word",
      },
    })
      .png()
      .toBuffer({ resolveWithObject: true });

  const [fg, shadowRaw] = await Promise.all([makeText("#FFFFFF"), makeText("#000000")]);
  const shadow = await sharp(shadowRaw.data).blur(Math.max(2, fontSize / 10)).png().toBuffer();

  const left = Math.round((width - fg.info.width) / 2);
  const top = Math.round(height * 0.74 - fg.info.height / 2);

  const gradient = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0.55" stop-color="#000" stop-opacity="0"/>
        <stop offset="0.85" stop-color="#000" stop-opacity="0.45"/>
        <stop offset="1" stop-color="#000" stop-opacity="0.55"/>
      </linearGradient></defs>
      <rect width="${width}" height="${height}" fill="url(#g)"/>
    </svg>`,
  );

  return sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: gradient, left: 0, top: 0 },
      { input: shadow, left: left + 2, top: top + 3 },
      { input: fg.data, left, top },
    ])
    .png()
    .toBuffer();
}

/** Crops/resizes any provider image to an exact 1080x1920 JPEG. */
export async function normalizeSceneImage(data: Buffer, width = 1080, height = 1920): Promise<Buffer> {
  return sharp(data).rotate().resize(width, height, { fit: "cover", position: "attention" }).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
}
