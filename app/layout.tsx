import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Inter, Playfair_Display } from "next/font/google";
import { BottomNav } from "@/components/ui/BottomNav";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { PwaRegister } from "@/components/ui/PwaRegister";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", weight: ["600", "700"] });

export const metadata: Metadata = {
  title: "AI Love Reel Studio",
  description: "Turn one idea into a cinematic love story Reel.",
  applicationName: "AI Love Reel Studio",
  appleWebApp: { capable: true, title: "Love Reels", statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0908",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className="studio-glow antialiased">
        <Suspense fallback={null}>
          <DemoBanner />
        </Suspense>
        <div className="mx-auto min-h-dvh w-full max-w-xl px-4 pb-28 pt-4">{children}</div>
        <BottomNav />
        <PwaRegister />
      </body>
    </html>
  );
}
