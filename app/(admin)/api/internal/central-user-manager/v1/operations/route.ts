import { createOperationsRouteHandlers } from "@/lib/central-user-manager/operations-route-handler";

const handlers = createOperationsRouteHandlers();

export const GET = handlers.methodNotAllowed;
export const POST = handlers.POST;
export const PUT = handlers.methodNotAllowed;
export const PATCH = handlers.methodNotAllowed;
export const DELETE = handlers.methodNotAllowed;
export const HEAD = handlers.methodNotAllowed;
export const OPTIONS = handlers.methodNotAllowed;
