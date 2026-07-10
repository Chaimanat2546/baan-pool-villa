import { requireHomeConfigAdmin } from "@/lib/admin/route-helpers";
import {
  buildAdminCustomerReviewImagesResponse,
  deleteAdminCustomerReviewImage,
  handleAdminCustomerReviewPatch,
  uploadAdminCustomerReviewImage,
} from "@/lib/customer-reviews/admin-route";

export async function GET(request: Request) {
  const admin = await requireHomeConfigAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  return buildAdminCustomerReviewImagesResponse(admin.supabase);
}

export async function POST(request: Request) {
  const admin = await requireHomeConfigAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  return uploadAdminCustomerReviewImage(request, admin.supabase);
}

export async function PATCH(request: Request) {
  const admin = await requireHomeConfigAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  return handleAdminCustomerReviewPatch(request, admin.supabase);
}

export async function DELETE(request: Request) {
  const admin = await requireHomeConfigAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  return deleteAdminCustomerReviewImage(request, admin.supabase);
}
