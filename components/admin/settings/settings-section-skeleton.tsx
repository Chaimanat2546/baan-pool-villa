import {
  AdminFieldRowsSkeleton,
  AdminListSkeleton,
  AdminPanelSkeleton,
  AdminPreviewSkeleton,
} from "@/components/admin/loading/admin-loading-primitives";

export function SettingsSectionSkeleton({
  showPreview = true,
}: {
  showPreview?: boolean;
}) {
  return (
    <div
      className="grid min-w-0 gap-5 lg:grid-cols-[240px_minmax(0,1fr)]"
      data-settings-section-skeleton="true"
    >
      <aside className="hidden lg:block">
        <AdminPanelSkeleton className="sticky top-6 p-3" titleWidth="w-28">
          <AdminListSkeleton items={6} />
        </AdminPanelSkeleton>
      </aside>
      <div
        className={`grid min-w-0 gap-5 ${
          showPreview ? "xl:grid-cols-[minmax(0,1fr)_320px]" : ""
        }`}
      >
        <AdminPanelSkeleton titleWidth="w-40">
          <AdminFieldRowsSkeleton rows={5} />
        </AdminPanelSkeleton>
        {showPreview ? (
          <AdminPanelSkeleton titleWidth="w-28">
            <AdminPreviewSkeleton rows={3} />
          </AdminPanelSkeleton>
        ) : null}
      </div>
    </div>
  );
}
