import { BookOpenText, Home, Search } from "lucide-react";

type NotFoundAction = {
  href: string;
  label: string;
  icon: "guides" | "home" | "search";
  variant?: "primary" | "secondary";
};

type PublicNotFoundPageProps = {
  title: string;
  description: string;
  actions: NotFoundAction[];
};

const ICONS = {
  guides: BookOpenText,
  home: Home,
  search: Search,
} as const;

export function PublicNotFoundPage({
  title,
  description,
  actions,
}: PublicNotFoundPageProps) {
  return (
    <main className="bg-[var(--site-surface-soft)] px-4 py-10 text-[var(--site-text)] sm:px-6 lg:px-8">
      <section className="mx-auto grid min-h-[68vh] w-full max-w-4xl place-items-center">
        <div className="w-full overflow-hidden rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] shadow-[0_18px_54px_rgba(6,63,53,0.1)]">
          <div className="grid gap-0 md:grid-cols-[0.9fr_1.6fr]">
            <div className="flex min-h-44 items-center justify-center border-b border-[var(--site-border)] bg-[var(--site-primary)] px-8 py-10 text-[var(--site-on-primary)] md:border-r md:border-b-0">
              <p className="text-7xl font-black leading-none tracking-normal sm:text-8xl">
                404
              </p>
            </div>
            <div className="px-6 py-9 text-center sm:px-10 md:text-left">
              <p className="text-xs font-bold uppercase tracking-normal text-[var(--site-muted)]">
                Page not found
              </p>
              <h1 className="mt-3 text-3xl font-black leading-tight text-[var(--site-text)] sm:text-4xl">
                {title}
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--site-muted)] sm:text-base">
                {description}
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap md:justify-start">
                {actions.map((action) => {
                  const Icon = ICONS[action.icon];
                  const isPrimary = action.variant !== "secondary";

                  return (
                    <a
                      key={`${action.href}:${action.label}`}
                      href={action.href}
                      className={
                        isPrimary
                          ? "inline-flex items-center justify-center gap-2 rounded-full bg-[var(--site-primary)] px-5 py-3 text-sm font-bold text-[var(--site-on-primary)] transition hover:bg-[var(--site-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--site-primary)]"
                          : "inline-flex items-center justify-center gap-2 rounded-full border border-[var(--site-border)] bg-[var(--site-surface)] px-5 py-3 text-sm font-bold text-[var(--site-text)] transition hover:border-[var(--site-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--site-primary)]"
                      }
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      {action.label}
                    </a>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export function GenericPublicNotFoundPage() {
  return (
    <PublicNotFoundPage
      title="ไม่พบหน้าที่คุณกำลังหา"
      description="ลิงก์นี้อาจถูกย้ายหรือไม่มีอยู่แล้ว ลองค้นหาบ้านพัก อ่านคู่มือ หรือกลับหน้าแรกเพื่อไปต่อ"
      actions={[
        { href: "/search?guests=2&bedrooms=1&maxPrice=58900", label: "ไปหน้าค้นหา", icon: "search" },
        {
          href: "/guides",
          label: "อ่านบทความ/คู่มือ",
          icon: "guides",
          variant: "secondary",
        },
        { href: "/", label: "กลับหน้าแรก", icon: "home", variant: "secondary" },
      ]}
    />
  );
}

export function VillaNotFoundPage() {
  return (
    <PublicNotFoundPage
      title="ไม่พบบ้านพักนี้"
      description="บ้านพักนี้อาจถูกปิดการแสดงผลหรือไม่มีอยู่แล้ว ลองกลับไปค้นหาบ้านพักอื่นที่พร้อมจองได้เลย"
      actions={[
        { href: "/search?guests=2&bedrooms=1&maxPrice=58900", label: "กลับไปค้นหาบ้านพัก", icon: "search" },
        { href: "/", label: "กลับหน้าแรก", icon: "home", variant: "secondary" },
      ]}
    />
  );
}
