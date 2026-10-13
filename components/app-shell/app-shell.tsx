"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import OwlMark from "@/components/owl-mark";
import { navigation } from "@/lib/navigation";
import LogoutButton from "./logout-button";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function SidebarContent({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-ink text-paper">
      <Link
        href="/dashboard"
        onClick={onNavigate}
        className="flex h-14 items-center gap-3 border-b border-paper/10 px-6"
      >
        <OwlMark className="h-4 w-auto" />
        <span className="text-xs tracking-[0.18em] uppercase">ReachOwl</span>
      </Link>

      <nav aria-label="Menu utama" className="flex-1 px-3 py-6">
        <p className="px-3 pb-3 font-mono text-[10px] uppercase tracking-wider text-paper/35">Menu</p>
        <ul className="space-y-px">
          {navigation.map((item, i) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex items-center gap-3 rounded-[3px] px-3 py-2.5 text-sm transition-colors ${
                    active ? "bg-paper/[0.07] text-paper" : "text-paper/55 hover:bg-paper/[0.04] hover:text-paper"
                  }`}
                >
                  {active && <span className="absolute inset-y-2 left-0 w-[2px] bg-accent" aria-hidden="true" />}
                  <span className="font-mono text-[10px] text-paper/35">{String(i + 1).padStart(2, "0")}</span>
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <p className="border-t border-paper/10 px-6 py-4 font-mono text-[10px] uppercase tracking-wider text-paper/30">
        © 2026 ReachOwl
      </p>
    </div>
  );
}

export default function AppShell({ userSlot, children }: { userSlot: ReactNode; children: ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const current = navigation.find((item) => isActive(pathname, item.href));

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <div className="min-h-screen flex-1 bg-paper text-ink">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 lg:block">
        <SidebarContent pathname={pathname} />
      </aside>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Tutup menu"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-ink/40"
          />
          <aside className="absolute inset-y-0 left-0 w-64 shadow-xl">
            <SidebarContent pathname={pathname} onNavigate={() => setMenuOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-h-screen flex-col lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-ink/10 bg-paper/95 px-4 backdrop-blur-sm sm:px-8">
          <div className="flex items-center gap-4">
            <button
              type="button"
              id="menu-toggle"
              onClick={() => setMenuOpen(true)}
              className="font-mono text-[11px] uppercase tracking-wider text-ink/60 hover:text-ink lg:hidden"
            >
              Menu
            </button>
            <span className="font-mono text-[11px] uppercase tracking-wider text-ink/45">
              {current?.label ?? "ReachOwl"}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:block">{userSlot}</div>
            <LogoutButton />
          </div>
        </header>

        <main className="flex-1 px-4 py-10 sm:px-8 lg:px-12">{children}</main>
      </div>
    </div>
  );
}
