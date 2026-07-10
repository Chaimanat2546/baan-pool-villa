import {
  AdminFieldRowsSkeleton,
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
      className={`grid min-w-0 gap-5 ${
        showPreview ? "xl:grid-cols-[minmax(0,1fr)_320px]" : ""
      }`}
      data-settings-section-skeleton="true"
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
  );
}
