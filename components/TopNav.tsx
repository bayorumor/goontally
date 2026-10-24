"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { useQuickLog } from "@/components/log/QuickLog";
import { isActive, NAV_ITEMS } from "@/lib/nav";

interface Props {
  user: { username: string; avatar: string | null };
}

// Sticky top bar. Phones get the logo and the profile avatar (the tabs live
// in the bottom nav); wider screens also get the tabs and a Log button.
export default function TopNav({ user }: Props) {
  const pathname = usePathname();
  const { openLog } = useQuickLog();

  return (
    <header className="sticky top-0 z-[100] border-b border-border bg-bg/95 pt-[env(safe-area-inset-top)] backdrop-saturate-150">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 md:px-6">
        <Link
          href="/"
          className="font-display text-[18px] font-bold tracking-tight"
        >
          Goontally
        </Link>

        <nav className="hidden flex-1 items-center gap-1 md:flex">
          {NAV_ITEMS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`rounded-sm px-3 py-1.5 text-[14px] font-medium transition-colors ${
                isActive(pathname, href)
                  ? "bg-surface-2 text-text"
                  : "text-muted hover:text-text"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <button
            className="btn btn-primary btn-sm hidden md:inline-flex"
            onClick={() => openLog()}
          >
            <Plus size={16} /> Log
          </button>
          <Link
            href="/profile"
            aria-label="Profile"
            className={`flex h-9 w-9 items-center justify-center rounded-full ring-2 transition ${
              pathname === "/profile"
                ? "ring-primary"
                : "ring-transparent hover:ring-border-strong"
            }`}
          >
            <Avatar src={user.avatar} name={user.username} size={32} />
          </Link>
        </div>
      </div>
    </header>
  );
}
