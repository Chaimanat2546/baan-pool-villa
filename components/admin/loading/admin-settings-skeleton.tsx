import {
  AdminCardGridSkeleton,
  AdminFieldRowsSkeleton,
  AdminHeaderSkeleton,
  AdminListSkeleton,
  AdminPanelSkeleton,
  AdminPreviewSkeleton,
} from "./admin-loading-primitives";

export function AdminSettingsSkeleton() {
  return (
    <div
      className="flex w-full flex-col gap-6 text-[var(--site-text)]"
      data-admin-settings-skeleton="true"
    >
      <AdminHeaderSkeleton actionCount={3} chipCount={1} />

      <div className="grid min-w-0 gap-6 xl:grid-cols-[220px_minmax(0,1fr)_360px]">
        <aside className="hidden xl:block">
          <AdminPanelSkeleton className="sticky top-36 p-3" titleWidth="w-28">
            <AdminListSkeleton items={5} />
          </AdminPanelSkeleton>
        </aside>

        <div className="grid min-w-0 gap-5">
          <AdminPanelSkeleton titleWidth="w-40">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
              <AdminFieldRowsSkeleton rows={4} />
              <AdminFieldRowsSkeleton rows={4} />
            </div>
          </AdminPanelSkeleton>

          <AdminPanelSkeleton titleWidth="w-32">
            <AdminCardGridSkeleton />
            <AdminFieldRowsSkeleton className="mt-4" rows={3} />
          </AdminPanelSkeleton>

          <AdminPanelSkeleton titleWidth="w-36">
            <AdminFieldRowsSkeleton rows={4} />
          </AdminPanelSkeleton>

          <AdminPanelSkeleton titleWidth="w-44">
            <AdminFieldRowsSkeleton rows={5} />
          </AdminPanelSkeleton>
        </div>

        <aside className="grid min-w-0 content-start gap-4 xl:sticky xl:top-36">
          <AdminPanelSkeleton titleWidth="w-32">
            <AdminPreviewSkeleton rows={4} />
          </AdminPanelSkeleton>
          <AdminPanelSkeleton titleWidth="w-36">
            <div className="overflow-hidden rounded-lg border border-[var(--site-border)] bg-white">
              <div className="h-28 bg-[var(--site-surface-tint)] px-4 py-4">
                <div className="flex gap-2">
                  <div className="h-9 w-24 rounded-md bg-[var(--site-primary-soft)]/70" />
                  <div className="h-9 w-28 rounded-md bg-[var(--site-surface)]/75" />
                </div>
              </div>
              <div className="p-4">
                <div className="h-12 w-12 rounded-full bg-[var(--site-surface-tint)]" />
                <div className="mt-4 space-y-3">
                  <div className="h-4 w-full rounded-md bg-[var(--site-surface-tint)]" />
                  <div className="h-4 w-4/5 rounded-md bg-[var(--site-surface-tint)]" />
                  <div className="h-10 w-28 rounded-md bg-[var(--site-surface-tint)]" />
                </div>
              </div>
            </div>
          </AdminPanelSkeleton>
        </aside>
      </div>
    </div>
  );
}
