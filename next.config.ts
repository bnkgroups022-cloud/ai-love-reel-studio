import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // FFmpeg is an optional local binary; never bundle it.
  serverExternalPackages: ["ffmpeg-static"],
  // FFmpeg is only used on your own computer; keep it out of Vercel functions.
  outputFileTracingExcludes: {
    "*": ["node_modules/ffmpeg-static/**"],
  },
  // The text-overlay font is read from disk by the render step.
  outputFileTracingIncludes: {
    "/api/jobs/advance": ["./public/fonts/**"],
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default nextConfig;
