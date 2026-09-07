import { AdminVillaReviewEditPage } from "@/components/admin/villa-reviews/admin-villa-review-edit-page";

export default async function AdminVillaReviewEditRoute({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const query = await searchParams;
  return <AdminVillaReviewEditPage id={id} back={typeof query.back === "string" ? query.back : "/admin/villa-reviews"} />;
}
