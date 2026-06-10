import {
  AdminFieldRowsSkeleton,
  AdminHeaderSkeleton,
  AdminListSkeleton,
  AdminPanelSkeleton,
  AdminPreviewSkeleton,
} from "./admin-loading-primitives";

export function AdminLegalSkeleton() {
  return (
    <div
      className="flex w-full flex-col gap-6 text-[var(--site-text)]"
      data-admin-legal-skeleton="true"
    >
      <AdminHeaderSkeleton actionCount={2} chipCount={1} />

      <div className="grid min-w-0 gap-6 xl:grid-cols-[260px_minmax(0,1fr)_360px]">
        <aside className="grid content-start gap-3 xl:sticky xl:top-36">
          <AdminPanelSkeleton className="p-3" titleWidth="w-28">
            <AdminListSkeleton items={2} />
          </AdminPanelSkeleton>
        </aside>

        <div className="grid min-w-0 gap-4">
          <AdminPanelSkeleton titleWidth="w-36">
            <AdminFieldRowsSkeleton rows={2} />
          </AdminPanelSkeleton>
          <AdminPanelSkeleton titleWidth="w-24">
            <AdminFieldRowsSkeleton rows={6} />
          </AdminPanelSkeleton>
          <AdminPanelSkeleton titleWidth="w-20">
            <AdminFieldRowsSkeleton rows={2} />
          </AdminPanelSkeleton>
        </div>

        <aside className="grid content-start gap-4 xl:sticky xl:top-36">
          <AdminPanelSkeleton titleWidth="w-28">
            <AdminPreviewSkeleton rows={4} />
          </AdminPanelSkeleton>
          <AdminPanelSkeleton titleWidth="w-32">
            <AdminPreviewSkeleton rows={7} />
          </AdminPanelSkeleton>
        </aside>
      </div>
    </div>
  );
}
