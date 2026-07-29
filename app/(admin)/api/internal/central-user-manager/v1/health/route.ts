import { createHealthRouteHandlers } from "@/lib/central-user-manager/health-route-handler";

const handlers = createHealthRouteHandlers();

export const GET = handlers.GET;
export const POST = handlers.methodNotAllowed;
export const PUT = handlers.methodNotAllowed;
export const PATCH = handlers.methodNotAllowed;
export const DELETE = handlers.methodNotAllowed;
export const HEAD = handlers.methodNotAllowed;
export const OPTIONS = handlers.methodNotAllowed;
