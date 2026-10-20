"use client";

import {
  ChevronLeft,
  ChevronRight,
  House,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { readAdminSessionState } from "@/components/admin/admin-auth";
import { createBrowserHomeConfigClient } from "@/lib/home-sections/supabase";
import type { SiteSettings } from "@/lib/site-settings/types";

import { ADMIN_NAV_ITEMS, getActiveAdminNavItem } from "./admin-nav";
import styles from "./admin-shell.module.css";
import {
  setAdminSidebarPreference,
  useAdminSidebarCollapsed,
} from "./admin-sidebar-preference";

interface AdminShellProps {
  children: React.ReactNode;
  initialDesktopNavCollapsed?: boolean;
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
      className="grid min-w-0 gap-1.5 overflow-x-hidden"
      data-admin-nav-layout={collapsed ? "collapsed" : "expanded"}
    >
      {ADMIN_NAV_ITEMS.filter((item) => !item.disabled).map((item) => {
        const Icon = item.icon;
        const isActive = pathname.startsWith(item.href);
        const visibleLabel = collapsed ? item.compactLabel : item.label;
        const className = `group rounded-md transition focus-visible:outline-2 focus-visible:outline-[var(--site-primary)] ${
          collapsed
            ? "flex min-h-12 flex-col items-center justify-center gap-1 px-1 py-2 text-center"
            : "flex min-h-9 items-center gap-2.5 px-2.5 py-2 text-left pointer-coarse:min-h-11"
        } ${
          isActive
            ? "bg-[var(--site-surface-tint)] text-[var(--site-text)]"
            : "text-[var(--site-muted)] hover:bg-[var(--site-surface-soft)] hover:text-[var(--site-text)]"
        }`;

        const content = (
          <>
            <span className="inline-flex size-4 shrink-0 items-center justify-center">
              <Icon aria-hidden="true" className="size-4" />
            </span>
            <span className={`min-w-0 ${collapsed ? "w-full" : "flex-1"}`}>
              <span
                className={`text-xs ${isActive ? "font-semibold" : "font-normal"} ${
                  collapsed
                    ? "block max-w-full truncate px-1 text-center text-[10px] leading-3"
                    : "block break-words"
                }`}
              >
                {visibleLabel}
              </span>
            </span>
          </>
        );

        return (
          <a
            aria-label={collapsed ? item.label : undefined}
            aria-current={isActive ? "page" : undefined}
            className={`min-w-0 max-w-full ${className}`}
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

export function AdminShell({
  children,
  initialDesktopNavCollapsed = false,
  settings,
}: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isDesktopNavCollapsed = useAdminSidebarCollapsed(
    initialDesktopNavCollapsed,
  );
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const activeItem = getActiveAdminNavItem(pathname);
  const compactSiteMark = getCompactSiteMark(settings.siteName);
  const isAuthPage =
    pathname === "/admin/login" ||
    pathname === "/admin/reset-password" ||
    pathname === "/admin/change-password";
  type SessionGateStatus =
    | "checking"
    | "ready"
    | "redirecting"
    | "verification_failed";
  const [sessionGate, setSessionGate] = useState<{
    pathname: string;
    status: SessionGateStatus;
  }>({
    pathname,
    status: isAuthPage ? "ready" : "checking",
  });
  const sessionGateStatus =
    sessionGate.pathname === pathname ? sessionGate.status : "checking";

  useEffect(() => {
    if (isAuthPage) {
      return;
    }
    let mounted = true;
    function updateSessionGate(status: SessionGateStatus) {
      setSessionGate((current) =>
        current.pathname === pathname && current.status === status
          ? current
          : { pathname, status },
      );
    }
    void readAdminSessionState().then(async (state) => {
      if (!mounted) {
        return;
      }
      if (state === "active") {
        updateSessionGate("ready");
        return;
      }
      if (state === "verification_failed") {
        updateSessionGate("verification_failed");
        return;
      }
      updateSessionGate("redirecting");
      if (state === "forced") {
        router.replace("/admin/change-password");
        return;
      }
      await createBrowserHomeConfigClient().auth.signOut({ scope: "local" });
      router.replace("/admin/login?error=admin-access");
    });
    return () => {
      mounted = false;
    };
  }, [isAuthPage, pathname, router]);

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

  if (sessionGateStatus !== "ready") {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[var(--site-surface-soft)] px-4 text-[var(--site-text)]">
        {sessionGateStatus === "verification_failed" ? (
          <p
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            ไม่สามารถตรวจสอบสิทธิ์แอดมินได้ กรุณาลองใหม่ภายหลัง
          </p>
        ) : (
          <p className="text-sm text-[var(--site-muted)]">
            กำลังตรวจสอบสิทธิ์...
          </p>
        )}
      </main>
    );
  }

  return (
    <div className={`${styles.workspace} min-h-dvh bg-[var(--site-surface-soft)] text-[var(--site-text)] lg:grid ${isDesktopNavCollapsed ? "lg:grid-cols-[76px_minmax(0,1fr)]" : "lg:grid-cols-[208px_minmax(0,1fr)]"}`}>
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-[var(--site-border)] bg-[var(--site-surface)] px-3 py-5 lg:flex" data-admin-sidebar-state={isDesktopNavCollapsed ? "collapsed" : "expanded"}>
        <div className={`flex min-w-0 gap-2 ${isDesktopNavCollapsed ? "flex-col items-center" : "items-center px-1"}`}>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-[var(--site-primary-soft)] text-[var(--site-primary)]"><House aria-hidden="true" className="size-4" /></span>
          {!isDesktopNavCollapsed && <p className="min-w-0 flex-1 break-words text-sm font-semibold">{settings.siteName}</p>}
          <button aria-label={isDesktopNavCollapsed ? "ขยายแถบเมนูหลังบ้าน" : "ย่อแถบเมนูหลังบ้าน"} className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-[var(--site-muted)] hover:bg-[var(--site-surface-soft)] focus-visible:outline-2 focus-visible:outline-[var(--site-primary)]" onClick={() => setAdminSidebarPreference(!isDesktopNavCollapsed)} type="button">
            {isDesktopNavCollapsed ? <ChevronRight aria-hidden="true" className="size-4" /> : <ChevronLeft aria-hidden="true" className="size-4" />}
          </button>
        </div>
        {isDesktopNavCollapsed && <p className="mt-1 truncate text-center text-[10px] text-[var(--site-muted)]" title={settings.siteName}>{compactSiteMark}</p>}
        <div className="mt-7 min-h-0 flex-1 overflow-y-auto">
          {!isDesktopNavCollapsed && <p className="mb-2 px-2.5 text-[11px] text-[var(--site-muted)]">จัดการเว็บไซต์</p>}
          <AdminNavigation collapsed={isDesktopNavCollapsed} />
        </div>
        <button aria-label="ออกจากระบบ" title={isDesktopNavCollapsed ? "ออกจากระบบ" : undefined} className={`mt-4 inline-flex min-h-10 shrink-0 items-center gap-2 border-t border-[var(--site-border)] pt-3 text-xs text-[var(--site-muted)] hover:text-[var(--site-text)] focus-visible:outline-2 focus-visible:outline-[var(--site-primary)] ${isDesktopNavCollapsed ? "justify-center" : "px-2.5"}`} onClick={handleLogout} type="button">
          <LogOut aria-hidden="true" className="size-4" /><span className={isDesktopNavCollapsed ? "sr-only" : undefined}>ออกจากระบบ</span>
        </button>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-[var(--site-border)] bg-[var(--site-surface)] px-4 text-xs text-[var(--site-muted)] sm:px-6 lg:static lg:px-7">
          <button aria-label="เปิดเมนูหลังบ้าน" className="inline-flex size-10 shrink-0 items-center justify-center rounded-md hover:bg-[var(--site-surface-soft)] lg:hidden" onClick={() => setIsMobileNavOpen(true)} type="button"><Menu aria-hidden="true" className="size-5" /></button>
          <span className="hidden sm:inline">เว็บไซต์</span><ChevronRight aria-hidden="true" className="hidden size-3 sm:block" />
          <span className="min-w-0 truncate">{activeItem.label}</span>
          <button aria-label="ออกจากระบบ" className="ml-auto inline-flex size-10 shrink-0 items-center justify-center rounded-md hover:bg-[var(--site-surface-soft)] lg:hidden" onClick={handleLogout} type="button"><LogOut aria-hidden="true" className="size-4" /></button>
        </header>
        <main className={`w-full px-4 py-6 sm:px-6 lg:px-7 ${isDesktopNavCollapsed ? "" : "mx-auto max-w-[1480px]"}`}>{children}</main>
      </div>
      {isMobileNavOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button aria-label="ปิดเมนูหลังบ้าน" className="absolute inset-0 bg-black/35" onClick={() => setIsMobileNavOpen(false)} type="button" />
          <aside className="relative flex h-full w-[min(300px,88vw)] flex-col bg-[var(--site-surface)] px-4 py-5 shadow-xl">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <p className="min-w-0 break-words text-sm font-semibold">{settings.siteName}</p>
              <button aria-label="ปิดเมนูหลังบ้าน" className="inline-flex size-10 shrink-0 items-center justify-center rounded-md hover:bg-[var(--site-surface-soft)]" onClick={() => setIsMobileNavOpen(false)} type="button"><X aria-hidden="true" className="size-5" /></button>
            </div>
            <div className="mt-5 flex-1 overflow-y-auto"><AdminNavigation onNavigate={() => setIsMobileNavOpen(false)} /></div>
          </aside>
        </div>
      )}
    </div>
  );
}
