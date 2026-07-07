import { AdminVillaCardHouseCustomPage } from "@/components/admin/villa-card-images/admin-villa-card-images-page";

export default async function AdminVillaCardHouseCustomRoute({
  params,
}: PageProps<"/admin/card-images/houses/[houseId]">) {
  const { houseId } = await params;

  return <AdminVillaCardHouseCustomPage houseId={houseId} />;
}
