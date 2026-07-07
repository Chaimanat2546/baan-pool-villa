import { AdminGuidesPage } from "@/components/admin/guides/admin-guides-page";

export default async function AdminGuideConfigRoute({
  params,
}: PageProps<"/admin/guides/[guideId]">) {
  const { guideId } = await params;

  return <AdminGuidesPage guideId={guideId} />;
}
