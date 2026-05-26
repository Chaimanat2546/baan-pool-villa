import { notFound } from "next/navigation";

import { VillaDetailPage } from "@/components/villas/detail-page";
import { fetchVillaPageData } from "@/lib/villas/server";

type VillaPageProps = {
  params: Promise<{ id: string }>;
};

export default async function Page({ params }: VillaPageProps) {
  const { id } = await params;
  const data = await fetchVillaPageData(id);

  if (!data) {
    notFound();
  }

  return <VillaDetailPage id={id} images={data.images} payload={data.payload} />;
}
