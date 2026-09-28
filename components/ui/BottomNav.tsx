"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "CREATE", icon: "M12 5v14M5 12h14" },
  { href: "/projects", label: "PROJECTS", icon: "M4 6h16M4 12h16M4 18h10" },
  { href: "/settings", label: "SETTINGS", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.3 7.3 0 0 0-2-1.2L14.5 3h-4l-.4 2.6a7.3 7.3 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1c.6.5 1.3.9 2 1.2l.4 2.6h4l.4-2.6c.7-.3 1.4-.7 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z" },
];

export function BottomNav() {
  const pathname = usePathname();
  if (pathname === "/login") return null;
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line/80 bg-ink/90 backdrop-blur-md" aria-label="Main">
      <div className="mx-auto grid max-w-xl grid-cols-3">
        {ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" || pathname.startsWith("/project/") || pathname === "/create" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold tracking-[0.14em] ${active ? "text-amber" : "text-muted"}`}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={item.icon} />
              </svg>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
