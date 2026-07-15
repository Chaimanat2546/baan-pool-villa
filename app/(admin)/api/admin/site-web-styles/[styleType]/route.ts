import { requireHomeConfigAdmin } from "@/lib/admin/route-helpers";
import {
  getAdminWebStyle,
  saveAdminWebStyle,
} from "@/lib/site-web-styles/admin-route";
import type { WebStyleType } from "@/lib/site-web-styles/types";

type Context = { params: Promise<{ styleType: string }> };

const STYLE_TYPES = new Set<WebStyleType>(["header", "gallery", "house_card"]);

async function readStyleType(context: Context): Promise<WebStyleType | null> {
  const { styleType } = await context.params;
  return STYLE_TYPES.has(styleType as WebStyleType)
    ? (styleType as WebStyleType)
    : null;
}

export async function GET(request: Request, context: Context) {
  const styleType = await readStyleType(context);
  if (!styleType) {
    return Response.json({ error: "Unknown web style type." }, { status: 404 });
  }

  const admin = await requireHomeConfigAdmin(request);
  return admin.ok
    ? getAdminWebStyle(styleType, admin.supabase)
    : admin.response;
}

export async function PATCH(request: Request, context: Context) {
  const styleType = await readStyleType(context);
  if (!styleType) {
    return Response.json({ error: "Unknown web style type." }, { status: 404 });
  }

  const admin = await requireHomeConfigAdmin(request);
  return admin.ok
    ? saveAdminWebStyle(styleType, request, admin.supabase)
    : admin.response;
}
