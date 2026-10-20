"use client";

import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  PanelLeftOpen,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { readAdminSessionState } from "@/components/admin/admin-auth";
import { createBrowserHomeConfigClient } from "@/lib/home-sections/supabase";
import type { SiteSettings } from "@/lib/site-settings/types";

import { getActiveAdminNavItem } from "./admin-nav";
import { AdminBrand } from "./admin-brand";
import { AdminMobileNavigation } from "./admin-mobile-navigation";
import { AdminNavigation } from "./admin-navigation";
import {
  setAdminSidebarPreference,
  useAdminSidebarCollapsed,
} from "./admin-sidebar-preference";

interface AdminShellProps {
  children: React.ReactNode;
  initialDesktopNavCollapsed?: boolean;
  settings: SiteSettings;
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
  const closeMobileNav = useCallback(() => setIsMobileNavOpen(false), []);
  const activeItem = getActiveAdminNavItem(pathname);
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
    <div className={`min-h-dvh bg-[var(--site-surface-soft)] text-[var(--site-text)] lg:grid ${isDesktopNavCollapsed ? "lg:grid-cols-[76px_minmax(0,1fr)]" : "lg:grid-cols-[208px_minmax(0,1fr)]"}`}>
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-[var(--site-border)] bg-[var(--site-surface)] px-3 py-5 lg:flex" data-admin-sidebar-state={isDesktopNavCollapsed ? "collapsed" : "expanded"}>
        <div className={`flex min-w-0 items-center gap-3 ${isDesktopNavCollapsed ? "flex-col" : "justify-between"}`}>
          <AdminBrand collapsed={isDesktopNavCollapsed} settings={settings} />
          <button aria-label={isDesktopNavCollapsed ? "ขยายแถบเมนูหลังบ้าน" : "ย่อแถบเมนูหลังบ้าน"} title={isDesktopNavCollapsed ? "ขยายแถบเมนูหลังบ้าน" : "ย่อแถบเมนูหลังบ้าน"} className="inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-[var(--site-border)] text-[var(--site-text)] hover:bg-[var(--site-primary-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--site-primary)]" onClick={() => setAdminSidebarPreference(!isDesktopNavCollapsed)} type="button">
            {isDesktopNavCollapsed ? <PanelLeftOpen aria-hidden="true" className="size-5" /> : <ChevronLeft aria-hidden="true" className="size-4" />}
          </button>
        </div>
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
      {isMobileNavOpen && <AdminMobileNavigation onClose={closeMobileNav} settings={settings} />}
    </div>
  );
}
