"use client";

import { usePathname } from "next/navigation";
import { Tooltip } from "radix-ui";
import { ADMIN_NAV_ITEMS } from "./admin-nav";

export function AdminNavigation({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <Tooltip.Provider delayDuration={150}>
      <nav aria-label="เมนูหลังบ้าน" className="grid min-w-0 gap-1.5 overflow-x-hidden" data-admin-nav-layout={collapsed ? "collapsed" : "expanded"}>
        {ADMIN_NAV_ITEMS.filter((item) => !item.disabled).map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          const link = (
            <a
              aria-label={collapsed ? item.label : undefined}
              aria-current={isActive ? "page" : undefined}
              className={`group flex min-w-0 max-w-full items-center rounded-md transition focus-visible:outline-2 focus-visible:outline-[var(--site-primary)] ${collapsed ? "min-h-11 justify-center px-2 py-2" : "min-h-9 gap-2.5 px-2.5 py-2 text-left pointer-coarse:min-h-11"} ${isActive ? "bg-[var(--site-primary)] text-[var(--site-on-primary)]" : "text-[var(--site-text)] hover:bg-[var(--site-primary-soft)]"}`}
              href={item.href}
              key={item.href}
              onClick={onNavigate}
            >
              <Icon aria-hidden="true" className={`shrink-0 ${collapsed ? "size-5" : "size-4"} ${isActive ? "text-[var(--site-on-primary)]" : "text-[var(--site-primary)]"}`} />
              <span className={collapsed ? "sr-only" : `min-w-0 flex-1 break-words text-xs ${isActive ? "font-semibold" : "font-normal"}`}>{item.label}</span>
            </a>
          );

          return collapsed ? (
            <Tooltip.Root key={item.href}>
              <Tooltip.Trigger asChild>{link}</Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content side="right" sideOffset={12} collisionPadding={8} className="z-50 max-w-64 rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] px-3 py-2 text-xs text-[var(--site-text)] shadow-md">
                  {item.label}
                  <Tooltip.Arrow className="fill-[var(--site-surface)]" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          ) : link;
        })}
      </nav>
    </Tooltip.Provider>
  );
}
