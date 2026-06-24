"use client";

import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { createBrowserHomeConfigClient } from "@/lib/home-sections/supabase";
import type { SiteSettings } from "@/lib/site-settings/types";

import { ADMIN_NAV_ITEMS, getActiveAdminNavItem } from "./admin-nav";
import {
  setAdminSidebarPreference,
  useAdminSidebarCollapsed,
} from "./admin-sidebar-preference";

interface AdminShellProps {
  children: React.ReactNode;
  settings: SiteSettings;
}

function getCompactSiteMark(siteName: string) {
  const words = siteName
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (words.length === 0) {
    return "ADM";
  }

  const compact = words
    .slice(0, 3)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return compact || siteName.slice(0, 3).toUpperCase();
}

function AdminNavigation({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="เมนูหลังบ้าน"
      className="grid gap-1.5"
      data-admin-nav-layout={collapsed ? "collapsed" : "expanded"}
    >
      {ADMIN_NAV_ITEMS.filter((item) => !item.disabled).map((item) => {
        const Icon = item.icon;
        const isActive = pathname.startsWith(item.href);
        const className = `group rounded-lg border transition ${
          collapsed
            ? "flex min-h-16 flex-col items-center justify-center gap-1.5 px-1 py-2 text-center"
            : "flex min-h-14 items-center gap-3 px-3 py-2.5 text-left"
        } ${
          isActive
            ? "border-[var(--site-primary)] bg-[var(--site-primary)] text-[var(--site-on-primary)]"
            : "border-transparent text-[var(--site-text)] hover:border-[var(--site-border)] hover:bg-[var(--site-surface)]"
        }`;

        const content = (
          <>
            <span
              className={`inline-flex shrink-0 items-center justify-center rounded-lg ${
                collapsed ? "size-8" : "size-9"
              } ${
                isActive
                  ? "bg-white/14 text-[var(--site-on-primary)]"
                  : "bg-[var(--site-surface)] text-[var(--site-primary)]"
              }`}
            >
              <Icon aria-hidden="true" className="size-4.5" />
            </span>
            <span className={`min-w-0 ${collapsed ? "w-full" : "flex-1"}`}>
              <span
                className={`text-sm font-semibold ${
                  collapsed
                    ? "block text-center text-[11px] leading-3 text-pretty"
                    : "flex items-center gap-2"
                }`}
              >
                {item.label}
              </span>
              {collapsed ? null : (
                <span
                  className={`mt-0.5 block text-xs leading-4 ${
                    isActive
                      ? "text-[var(--site-on-primary)]/74"
                      : "text-[var(--site-muted)]"
                  }`}
                >
                  {item.description}
                </span>
              )}
            </span>
          </>
        );

        return (
          <a
            className={className}
            href={item.href}
            key={item.href}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
          >
            {content}
          </a>
        );
      })}
    </nav>
  );
}

export function AdminShell({ children, settings }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isDesktopNavCollapsed = useAdminSidebarCollapsed();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const activeItem = getActiveAdminNavItem(pathname);
  const compactSiteMark = getCompactSiteMark(settings.siteName);
  const isAuthPage =
    pathname === "/admin/login" || pathname === "/admin/reset-password";

  async function handleLogout() {
    const supabase = createBrowserHomeConfigClient();
    await supabase.auth.signOut();
    router.replace("/admin/login");
  }

  if (isAuthPage) {
    return (
      <main className="min-h-dvh bg-[var(--site-surface-soft)] text-[var(--site-text)]">
        {children}
      </main>
    );
  }

  return (
    <div
      className={`min-h-dvh bg-[var(--site-surface-soft)] text-[var(--site-text)] lg:grid ${
        isDesktopNavCollapsed
          ? "lg:grid-cols-[84px_minmax(0,1fr)]"
          : "lg:grid-cols-[280px_minmax(0,1fr)]"
      }`}
    >
      <aside
        className={`sticky top-0 hidden h-dvh border-r border-[var(--site-border)] bg-[var(--site-surface)] py-4 lg:flex lg:flex-col ${
          isDesktopNavCollapsed ? "px-2" : "px-4"
        }`}
        data-admin-sidebar-state={isDesktopNavCollapsed ? "collapsed" : "expanded"}
      >
        <div
          className={`rounded-lg bg-[var(--site-primary)] text-[var(--site-on-primary)] ${
            isDesktopNavCollapsed ? "px-2 py-2.5" : "px-4 py-4"
          }`}
        >
          <div
            className={`flex ${
              isDesktopNavCollapsed
                ? "flex-col items-center gap-2"
                : "items-start justify-between gap-3"
            }`}
          >
            <div className={`min-w-0 ${isDesktopNavCollapsed ? "text-center" : ""}`}>
              {isDesktopNavCollapsed ? null : (
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--site-on-primary)]/75">
                  หลังบ้าน
                </p>
              )}
              {isDesktopNavCollapsed ? (
                <p className="mt-1 text-base font-semibold tracking-[0.08em]">
                  {compactSiteMark}
                </p>
              ) : (
                <>
                  <p className="mt-1 text-xl font-semibold tracking-normal">
                    {settings.siteName}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--site-on-primary)]/72">
                    จัดการข้อมูลที่แสดงบนเว็บไซต์
                  </p>
                </>
              )}
            </div>
            <button
              aria-label={
                isDesktopNavCollapsed
                  ? "ขยายแถบเมนูหลังบ้าน"
                  : "ย่อแถบเมนูหลังบ้าน"
              }
              className={`inline-flex shrink-0 items-center justify-center rounded-lg bg-white/12 text-[var(--site-on-primary)] transition hover:bg-white/18 ${
                isDesktopNavCollapsed ? "size-8" : "size-9"
              }`}
              onClick={() => {
                setAdminSidebarPreference(!isDesktopNavCollapsed);
              }}
              type="button"
            >
              {isDesktopNavCollapsed ? (
                <ChevronRight aria-hidden="true" className="size-4.5" />
              ) : (
                <ChevronLeft aria-hidden="true" className="size-4.5" />
              )}
            </button>
          </div>
        </div>

        <div
          className={`mt-4 flex-1 overflow-y-auto ${
            isDesktopNavCollapsed ? "" : "pr-1"
          }`}
        >
          <AdminNavigation collapsed={isDesktopNavCollapsed} />
        </div>

        <button
          className={`mt-4 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] text-sm font-semibold text-[var(--site-primary)] transition hover:bg-[var(--site-primary-soft)] ${
            isDesktopNavCollapsed
              ? "inline-flex min-h-16 flex-col items-center justify-center gap-1.5 px-1 py-2 text-center text-[11px] leading-3"
              : "inline-flex h-11 items-center justify-center gap-2 px-4"
          }`}
          onClick={handleLogout}
          type="button"
        >
          <LogOut aria-hidden="true" className="size-4" />
          <span className={isDesktopNavCollapsed ? "leading-4" : ""}>
            ออกจากระบบ
          </span>
        </button>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-[var(--site-border)] bg-[var(--site-surface-soft)]/92 px-4 py-3 backdrop-blur sm:px-6 lg:hidden">
          <div className="mx-auto flex w-full max-w-[1480px] items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                aria-label="เปิดเมนูหลังบ้าน"
                className="inline-flex size-10 items-center justify-center rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] text-[var(--site-primary)] lg:hidden"
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
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-3 text-sm font-semibold text-[var(--site-primary)] transition hover:bg-[var(--site-primary-soft)]"
              onClick={handleLogout}
              type="button"
            >
              <LogOut aria-hidden="true" className="size-4" />
              <span className="hidden sm:inline">ออกจากระบบ</span>
            </button>
          </div>
        </header>

        <main
          className={`w-full px-4 py-4 sm:px-6 lg:px-8 ${
            isDesktopNavCollapsed ? "" : "mx-auto max-w-[1480px]"
          }`}
        >
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
          <aside className="relative flex h-full w-[min(340px,88vw)] flex-col bg-[var(--site-surface)] px-4 py-4 shadow-xl">
            <div className="flex items-start justify-between gap-3 rounded-lg bg-[var(--site-primary)] px-4 py-4 text-[var(--site-on-primary)]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--site-on-primary)]/75">
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
