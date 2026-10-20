import { requireHomeConfigAdmin } from "@/lib/admin/route-helpers";
import {
  deleteAdminAdvertisement,
  listAdminAdvertisements,
  saveAdminAdvertisement,
} from "@/lib/advertisements/admin-route";

export async function GET(request: Request) {
  const admin = await requireHomeConfigAdmin(request);
  return admin.ok
    ? listAdminAdvertisements(request, admin.supabase)
    : admin.response;
}
export async function POST(request: Request) {
  const admin = await requireHomeConfigAdmin(request);
  return admin.ok
    ? saveAdminAdvertisement(request, admin.supabase)
    : admin.response;
}
export async function DELETE(request: Request) {
  const admin = await requireHomeConfigAdmin(request);
  return admin.ok
    ? deleteAdminAdvertisement(request, admin.supabase)
    : admin.response;
}
