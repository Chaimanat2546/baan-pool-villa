import {
  AdminEditorCanvasSkeleton,
  AdminFieldRowsSkeleton,
  AdminHeaderSkeleton,
  AdminPanelSkeleton,
  AdminPreviewSkeleton,
} from "./admin-loading-primitives";

export function AdminDetailLayoutSkeleton() {
  return (
    <div
      className="flex w-full flex-col gap-6 text-[var(--site-text)]"
      data-admin-detail-layout-skeleton="true"
    >
      <AdminHeaderSkeleton
        actionCount={3}
        chipCount={1}
        showStats
        statsCount={4}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(260px,300px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(260px,300px)_minmax(0,1fr)_360px]">
        <aside className="grid content-start gap-4 xl:sticky xl:top-36 xl:self-start">
          <AdminPanelSkeleton titleWidth="w-28">
            <div className="space-y-3">
              {Array.from({ length: 6 }, (_, index) => (
                <div
                  className="h-12 rounded-md bg-[var(--site-surface-tint)]"
                  key={`block-${index}`}
                />
              ))}
            </div>
          </AdminPanelSkeleton>
        </aside>

        <main className="min-w-0">
          <AdminEditorCanvasSkeleton />
        </main>

        <aside className="grid content-start gap-4 2xl:sticky 2xl:top-36 2xl:self-start">
          <AdminPanelSkeleton titleWidth="w-36">
            <AdminFieldRowsSkeleton rows={5} />
          </AdminPanelSkeleton>
          <AdminPanelSkeleton titleWidth="w-24">
            <AdminPreviewSkeleton rows={4} />
          </AdminPanelSkeleton>
        </aside>
      </div>
    </div>
  );
}
