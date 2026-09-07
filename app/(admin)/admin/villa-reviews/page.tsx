import { AdminVillaReviewsPage } from "@/components/admin/villa-reviews/admin-villa-reviews-page";

export default async function AdminVillaReviewsRoute({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const initialQuery = Object.fromEntries(Object.entries(raw).flatMap(([key, value]) => typeof value === "string" ? [[key, value]] : []));
  return <AdminVillaReviewsPage initialQuery={initialQuery} />;
}
