import { AdminVillaCardHouseListPage } from "@/components/admin/villa-card-images/admin-villa-card-images-page";

export default async function AdminVillaCardHouseListRoute({
  searchParams,
}: PageProps<"/admin/card-images/houses">) {
  const query = await searchParams;

  return (
    <AdminVillaCardHouseListPage
      initialPage={typeof query.page === "string" ? query.page : undefined}
      initialSearch={
        typeof query.search === "string" ? query.search : undefined
      }
    />
  );
}
