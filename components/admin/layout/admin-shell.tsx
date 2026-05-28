"use client";

import { LogOut, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { createBrowserHomeConfigClient } from "@/lib/home-sections/supabase";

import { ADMIN_NAV_ITEMS, getActiveAdminNavItem } from "./admin-nav";

type AdminShellProps = {
  children: React.ReactNode;
};

function AdminNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="เมนูหลังบ้าน" className="grid gap-1.5">
      {ADMIN_NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = !item.disabled && pathname.startsWith(item.href);
        const className = `group flex min-h-14 items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
          isActive
            ? "border-[#0f5a45] bg-[#0f5a45] text-white shadow-[0_12px_24px_rgba(6,63,53,0.16)]"
            : item.disabled
              ? "cursor-not-allowed border-transparent text-[#8aa098]"
              : "border-transparent text-[#244a41] hover:border-[#d9e5df] hover:bg-white"
        }`;

        const content = (
          <>
            <span
              className={`inline-flex size-9 shrink-0 items-center justify-center rounded-lg ${
                isActive
                  ? "bg-white/14 text-white"
                  : "bg-white text-[#0f5a45] shadow-[0_1px_0_rgba(6,63,53,0.08)]"
              }`}
            >
              <Icon aria-hidden="true" className="size-4.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-sm font-semibold">
                {item.label}
                {item.disabled ? (
                  <span className="rounded-full bg-[#e7eee9] px-2 py-0.5 text-[10px] font-semibold text-[#6c8179]">
                    เร็ว ๆ นี้
                  </span>
                ) : null}
              </span>
              <span
                className={`mt-0.5 block text-xs leading-4 ${
                  isActive ? "text-white/74" : "text-[#6a7f78]"
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

export function AdminShell({ children }: AdminShellProps) {
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
      <main className="min-h-dvh bg-[#eef3ef] text-[#063f35]">
        {children}
      </main>
    );
  }

  return (
    <div className="min-h-dvh bg-[#edf3ef] text-[#0f332d] lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh border-r border-[#d7e2dc] bg-[#f7faf7] px-4 py-4 lg:flex lg:flex-col">
        <div className="rounded-2xl bg-[#064e3b] px-4 py-4 text-white shadow-[0_18px_40px_rgba(6,63,53,0.14)]">
          <p className="text-xs font-semibold text-[#facc15]">หลังบ้าน</p>
          <p className="mt-1 text-xl font-semibold tracking-normal">
            Baan Pool Villa
          </p>
          <p className="mt-1 text-xs leading-5 text-white/72">
            จัดการข้อมูลที่แสดงบนเว็บไซต์
          </p>
        </div>

        <div className="mt-4 flex-1 overflow-y-auto pr-1">
          <AdminNavigation />
        </div>

        <button
          className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#cddbd4] bg-white px-4 text-sm font-semibold text-[#0f4c3e] transition hover:bg-[#f2f7f4]"
          onClick={handleLogout}
          type="button"
        >
          <LogOut aria-hidden="true" className="size-4" />
          ออกจากระบบ
        </button>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-[#d7e2dc] bg-[#edf3ef]/92 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-[1480px] items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                aria-label="เปิดเมนูหลังบ้าน"
                className="inline-flex size-10 items-center justify-center rounded-xl border border-[#cddbd4] bg-white text-[#0f4c3e] lg:hidden"
                onClick={() => setIsMobileNavOpen(true)}
                type="button"
              >
                <Menu aria-hidden="true" className="size-5" />
              </button>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#6b8078]">
                  หลังบ้าน
                </p>
                <h1 className="truncate text-lg font-semibold text-[#063f35] sm:text-xl">
                  {activeItem.pageTitle}
                </h1>
              </div>
            </div>

            <button
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#cddbd4] bg-white px-3 text-sm font-semibold text-[#0f4c3e] transition hover:bg-[#f2f7f4]"
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
            className="absolute inset-0 bg-[#052d25]/45"
            onClick={() => setIsMobileNavOpen(false)}
            type="button"
          />
          <aside className="relative flex h-full w-[min(340px,88vw)] flex-col bg-[#f7faf7] px-4 py-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3 rounded-2xl bg-[#064e3b] px-4 py-4 text-white">
              <div>
                <p className="text-xs font-semibold text-[#facc15]">หลังบ้าน</p>
                <p className="mt-1 text-xl font-semibold tracking-normal">
                  Baan Pool Villa
                </p>
              </div>
              <button
                aria-label="ปิดเมนูหลังบ้าน"
                className="inline-flex size-9 items-center justify-center rounded-lg bg-white/12 text-white"
                onClick={() => setIsMobileNavOpen(false)}
                type="button"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>
            <div className="mt-4 flex-1 overflow-y-auto">
              <AdminNavigation onNavigate={() => setIsMobileNavOpen(false)} />
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
