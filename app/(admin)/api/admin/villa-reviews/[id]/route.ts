import { requireHomeConfigAdmin } from "@/lib/admin/route-helpers";
import { AdminVillaReviewError, deleteAdminVillaReview, getAdminVillaReviewDetail, updateAdminVillaReview } from "@/lib/villa-reviews/admin";
import { MAX_REVIEW_COMMENT_LENGTH, MAX_REVIEW_IMAGE_BYTES, MAX_REVIEW_IMAGES } from "@/lib/villa-reviews/input-validation";
import { reviewErrorResponse, reviewJson } from "../response";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Five maximum-size images, plus room for multipart headers and text fields.
const MAX_FORM_BYTES = MAX_REVIEW_IMAGES * MAX_REVIEW_IMAGE_BYTES + 64 * 1024;

function invalidForm(field = "review") {
  return new AdminVillaReviewError("validation_error", "กรุณาตรวจสอบข้อมูลรีวิว", 400, { [field]: "ข้อมูลไม่ถูกต้องหรือมีขนาดเกินกำหนด" });
}

function assertReviewId(id: string) {
  if (!UUID.test(id)) throw new AdminVillaReviewError("not_found", "ไม่พบรีวิวนี้", 404);
}

async function parseForm(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^multipart\/form-data(?:;|$)/i.test(contentType) || !request.body) throw invalidForm();
  let size = 0;
  let form: FormData;
  try {
    const boundedBody = request.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        size += chunk.byteLength;
        if (size > MAX_FORM_BYTES) throw invalidForm("images");
        controller.enqueue(chunk);
      },
    }));
    form = await new Response(boundedBody, { headers: { "Content-Type": contentType } }).formData();
  } catch (error) {
    if (error instanceof AdminVillaReviewError) throw error;
    throw invalidForm();
  }
  if ([...form.keys()].some((key) => !["rating", "comment", "retainedImageIds", "images"].includes(key))) throw invalidForm();
  const stringField = (key: string, maxLength: number) => {
    const values = form.getAll(key);
    if (values.length !== 1 || typeof values[0] !== "string" || values[0].length > maxLength) {
      throw invalidForm(key === "retainedImageIds" ? "images" : key);
    }
    return values[0];
  };
  const rating = stringField("rating", 1);
  if (!/^[1-5]$/.test(rating)) throw invalidForm("rating");
  const comment = stringField("comment", MAX_REVIEW_COMMENT_LENGTH);
  const retained = stringField("retainedImageIds", 1024);
  let retainedImageIds: unknown;
  try { retainedImageIds = JSON.parse(retained); }
  catch { throw invalidForm("images"); }
  const files: File[] = [];
  for (const value of form.getAll("images")) {
    if (!(value instanceof File)) throw invalidForm("images");
    files.push(value);
  }
  return { input: { rating: Number(rating), comment, retainedImageIds }, files };
}

export async function GET(request: Request, context: RouteContext<"/api/admin/villa-reviews/[id]">) {
  const admin = await requireHomeConfigAdmin(request);
  if (!admin.ok) return admin.response;
  const { id } = await context.params;
  try {
    assertReviewId(id);
    const detail = await getAdminVillaReviewDetail(id);
    if (!detail) throw new AdminVillaReviewError("not_found", "ไม่พบรีวิวนี้", 404);
    return reviewJson(detail);
  } catch (error) {
    return reviewErrorResponse(error, "ไม่สามารถโหลดรายละเอียดรีวิวได้");
  }
}

export async function PATCH(request: Request, context: RouteContext<"/api/admin/villa-reviews/[id]">) {
  const admin = await requireHomeConfigAdmin(request); if (!admin.ok) return admin.response;
  const { id } = await context.params;
  try {
    assertReviewId(id);
    const { input, files } = await parseForm(request);
    return reviewJson(await updateAdminVillaReview({ id, editorId: admin.userId, input, files }));
  } catch (error) {
    return reviewErrorResponse(error, "ไม่สามารถบันทึกรีวิวได้");
  }
}

export async function DELETE(request: Request, context: RouteContext<"/api/admin/villa-reviews/[id]">) {
  const admin = await requireHomeConfigAdmin(request); if (!admin.ok) return admin.response;
  const { id } = await context.params;
  try {
    assertReviewId(id);
    return reviewJson(await deleteAdminVillaReview({ id, editorId: admin.userId }));
  } catch (error) {
    return reviewErrorResponse(error, "ไม่สามารถลบรีวิวและรูปภาพได้");
  }
}
