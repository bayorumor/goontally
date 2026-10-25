"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { useQuickLog } from "@/components/log/QuickLog";
import { useKeyboardOpen } from "@/components/ui/useKeyboardOpen";
import { isActive, NAV_ITEMS } from "@/lib/nav";

// Phone tab bar: two tabs, the log button, two tabs.
export default function BottomNav() {
  const pathname = usePathname();
  const { openLog } = useQuickLog();
  const keyboardOpen = useKeyboardOpen();
  const [left, right] = [NAV_ITEMS.slice(0, 2), NAV_ITEMS.slice(2)];

  const tab = ({ href, label, icon: Icon }: (typeof NAV_ITEMS)[number]) => {
    const active = isActive(pathname, href);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={`flex flex-1 flex-col items-center gap-0.5 pt-2 text-[11px] font-medium transition-colors ${
          active ? "text-primary-text" : "text-subtle"
        }`}
      >
        <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
        {label}
      </Link>
    );
  };

  // When the keyboard shrinks the screen, the bar would ride up on top of
  // it and cover the bottom of sheets; it isn't needed while typing.
  if (keyboardOpen) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-[200] border-t border-border bg-surface-1 pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="flex h-[var(--bottom-nav-h)] items-start">
        {left.map(tab)}
        <div className="flex flex-1 justify-center pt-1.5">
          <button
            onClick={() => openLog()}
            aria-label="Log entry"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-white transition active:scale-95"
          >
            <Plus size={24} />
          </button>
        </div>
        {right.map(tab)}
      </div>
    </nav>
  );
}
