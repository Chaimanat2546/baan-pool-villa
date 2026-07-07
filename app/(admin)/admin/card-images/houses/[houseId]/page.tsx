import { AdminVillaCardHouseCustomPage } from "@/components/admin/villa-card-images/admin-villa-card-images-page";

export default async function AdminVillaCardHouseCustomRoute({
  params,
  searchParams,
}: PageProps<"/admin/card-images/houses/[houseId]">) {
  const [{ houseId }, query] = await Promise.all([params, searchParams]);

  return (
    <AdminVillaCardHouseCustomPage
      houseId={houseId}
      returnPage={typeof query.page === "string" ? query.page : undefined}
      returnSearch={
        typeof query.search === "string" ? query.search : undefined
      }
    />
  );
}
