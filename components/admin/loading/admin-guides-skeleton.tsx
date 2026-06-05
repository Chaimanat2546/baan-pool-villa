import {
  AdminHeaderSkeleton,
  AdminListSkeleton,
  AdminPanelSkeleton,
} from "./admin-loading-primitives";

export function AdminGuidesSkeleton() {
  return (
    <div
      className="flex w-full flex-col gap-6 text-[var(--site-text)]"
      data-admin-guides-skeleton="true"
    >
      <AdminHeaderSkeleton actionCount={3} chipCount={2} />

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(280px,320px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(280px,320px)_minmax(0,1fr)_380px]">
        <div className="min-w-0 xl:sticky xl:top-36 xl:self-start">
          <AdminPanelSkeleton titleWidth="w-36">
            <AdminListSkeleton items={5} />
          </AdminPanelSkeleton>
        </div>

        <main className="min-w-0">
          <section className="overflow-hidden rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] shadow-sm">
            <div className="sticky top-0 z-30 flex flex-nowrap items-center gap-2 overflow-x-auto border-b border-[var(--site-border)] bg-[var(--site-surface)]/95 px-4 py-3 backdrop-blur">
              {Array.from({ length: 6 }, (_, index) => (
                <div
                  className="h-9 w-9 rounded-md bg-[var(--site-surface-tint)]"
                  key={`toolbar-${index}`}
                />
              ))}
            </div>

            <div className="space-y-6 p-4 sm:p-5">
              <div className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] px-4 py-4 shadow-sm">
                <div className="flex gap-2">
                  <div className="h-6 w-24 rounded-full bg-[var(--site-surface-tint)]" />
                  <div className="h-6 w-16 rounded-full bg-[var(--site-surface-tint)]" />
                </div>
                <div className="mt-4 h-12 w-full max-w-[26rem] rounded-md bg-[var(--site-surface-tint)]" />
                <div className="mt-3 h-8 w-full max-w-[30rem] rounded-md bg-[var(--site-surface-tint)]" />
              </div>

              <div className="space-y-4">
                <div className="h-7 w-3/4 rounded-md bg-[var(--site-surface-tint)]" />
                {Array.from({ length: 8 }, (_, index) => (
                  <div
                    className="h-4 w-full rounded-md bg-[var(--site-surface-tint)]"
                    key={`line-${index}`}
                  />
                ))}
                <div className="h-52 w-full rounded-xl bg-[var(--site-surface-tint)]" />
                {Array.from({ length: 5 }, (_, index) => (
                  <div
                    className="h-4 w-full rounded-md bg-[var(--site-surface-tint)]"
                    key={`tail-${index}`}
                  />
                ))}
              </div>
            </div>
          </section>
        </main>

        <aside className="min-w-0 xl:col-start-2 2xl:sticky 2xl:top-36 2xl:col-start-auto 2xl:self-start">
          <AdminPanelSkeleton titleWidth="w-32">
            <div className="space-y-4">
              <div className="h-40 rounded-xl bg-[var(--site-surface-tint)]" />
              {Array.from({ length: 6 }, (_, index) => (
                <div className="grid gap-2" key={`field-${index}`}>
                  <div className="h-4 w-24 rounded-md bg-[var(--site-surface-tint)]" />
                  <div className="h-10 w-full rounded-md bg-[var(--site-surface-tint)]" />
                </div>
              ))}
              <div className="flex gap-2">
                <div className="h-10 flex-1 rounded-md bg-[var(--site-surface-tint)]" />
                <div className="h-10 flex-1 rounded-md bg-[var(--site-surface-tint)]" />
              </div>
            </div>
          </AdminPanelSkeleton>
        </aside>
      </div>
    </div>
  );
}
