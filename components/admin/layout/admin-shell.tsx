"use client";

import { LogOut, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { createBrowserHomeConfigClient } from "@/lib/home-sections/supabase";
import type { SiteSettings } from "@/lib/site-settings/types";

import { ADMIN_NAV_ITEMS, getActiveAdminNavItem } from "./admin-nav";

interface AdminShellProps {
  children: React.ReactNode;
  settings: SiteSettings;
}

function AdminNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="เมนูหลังบ้าน" className="grid gap-1.5">
      {ADMIN_NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = !item.disabled && pathname.startsWith(item.href);
        const className = `group flex min-h-14 items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
          isActive
            ? "border-[var(--site-primary)] bg-[var(--site-primary)] text-[var(--site-on-primary)] shadow-lg"
            : item.disabled
              ? "cursor-not-allowed border-transparent text-[var(--site-muted)]"
              : "border-transparent text-[var(--site-text)] hover:border-[var(--site-border)] hover:bg-[var(--site-surface)]"
        }`;

        const content = (
          <>
            <span
              className={`inline-flex size-9 shrink-0 items-center justify-center rounded-lg ${
                isActive
                  ? "bg-white/14 text-[var(--site-on-primary)]"
                  : "bg-[var(--site-surface)] text-[var(--site-primary)] shadow-sm"
              }`}
            >
              <Icon aria-hidden="true" className="size-4.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-sm font-semibold">
                {item.label}
                {item.disabled ? (
                  <span className="rounded-full bg-[var(--site-primary-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--site-muted)]">
                    เร็ว ๆ นี้
                  </span>
                ) : null}
              </span>
              <span
                className={`mt-0.5 block text-xs leading-4 ${
                  isActive ? "text-[var(--site-on-primary)]/74" : "text-[var(--site-muted)]"
                }`}
              >
                {item.description}
              </span>
            </span>
          </>
        );

        if (item.disabled) {
          return (
            <div
              aria-disabled="true"
              className={className}
              key={item.href}
              role="link"
            >
              {content}
            </div>
          );
        }

        return (
          <Link
            className={className}
            href={item.href}
            key={item.href}
            onClick={onNavigate}
          >
            {content}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminShell({ children, settings }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const activeItem = getActiveAdminNavItem(pathname);
  const isLoginPage = pathname === "/admin/login";

  async function handleLogout() {
    const supabase = createBrowserHomeConfigClient();
    await supabase.auth.signOut();
    router.replace("/admin/login");
  }

  if (isLoginPage) {
    return (
      <main className="min-h-dvh bg-[var(--site-surface-soft)] text-[var(--site-text)]">
        {children}
      </main>
    );
  }

  return (
    <div className="min-h-dvh bg-[var(--site-surface-soft)] text-[var(--site-text)] lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh border-r border-[var(--site-border)] bg-[var(--site-surface)] px-4 py-4 lg:flex lg:flex-col">
        <div className="rounded-2xl bg-[var(--site-primary)] px-4 py-4 text-[var(--site-on-primary)] shadow-lg">
          <p className="text-xs font-semibold text-[var(--site-accent)]">
            หลังบ้าน
          </p>
          <p className="mt-1 text-xl font-semibold tracking-normal">
            {settings.siteName}
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--site-on-primary)]/72">
            จัดการข้อมูลที่แสดงบนเว็บไซต์
          </p>
        </div>

        <div className="mt-4 flex-1 overflow-y-auto pr-1">
          <AdminNavigation />
        </div>

        <button
          className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-4 text-sm font-semibold text-[var(--site-primary)] transition hover:bg-[var(--site-primary-soft)]"
          onClick={handleLogout}
          type="button"
        >
          <LogOut aria-hidden="true" className="size-4" />
          ออกจากระบบ
        </button>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-[var(--site-border)] bg-[var(--site-surface-soft)]/92 px-4 py-3 backdrop-blur sm:px-6 lg:hidden">
          <div className="mx-auto flex w-full max-w-[1480px] items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                aria-label="เปิดเมนูหลังบ้าน"
                className="inline-flex size-10 items-center justify-center rounded-xl border border-[var(--site-border-strong)] bg-[var(--site-surface)] text-[var(--site-primary)] lg:hidden"
                onClick={() => {
                  setIsMobileNavOpen(true);
                }}
                type="button"
              >
                <Menu aria-hidden="true" className="size-5" />
              </button>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--site-muted)]">
                  หลังบ้าน
                </p>
                <h1 className="truncate text-lg font-semibold text-[var(--site-text)] sm:text-xl">
                  {activeItem.pageTitle}
                </h1>
              </div>
            </div>

            <button
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-3 text-sm font-semibold text-[var(--site-primary)] transition hover:bg-[var(--site-primary-soft)]"
              onClick={handleLogout}
              type="button"
            >
              <LogOut aria-hidden="true" className="size-4" />
              <span className="hidden sm:inline">ออกจากระบบ</span>
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1480px] px-4 py-4 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>

      {isMobileNavOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            aria-label="ปิดเมนูหลังบ้าน"
            className="absolute inset-0 bg-[var(--site-primary)]/45"
            onClick={() => {
              setIsMobileNavOpen(false);
            }}
            type="button"
          />
          <aside className="relative flex h-full w-[min(340px,88vw)] flex-col bg-[var(--site-surface)] px-4 py-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3 rounded-2xl bg-[var(--site-primary)] px-4 py-4 text-[var(--site-on-primary)]">
              <div>
                <p className="text-xs font-semibold text-[var(--site-accent)]">
                  หลังบ้าน
                </p>
                <p className="mt-1 text-xl font-semibold tracking-normal">
                  {settings.siteName}
                </p>
              </div>
              <button
                aria-label="ปิดเมนูหลังบ้าน"
                className="inline-flex size-9 items-center justify-center rounded-lg bg-white/12 text-[var(--site-on-primary)]"
                onClick={() => {
                  setIsMobileNavOpen(false);
                }}
                type="button"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>
            <div className="mt-4 flex-1 overflow-y-auto">
              <AdminNavigation
                onNavigate={() => {
                  setIsMobileNavOpen(false);
                }}
              />
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
