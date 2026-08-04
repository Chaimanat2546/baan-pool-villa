const BLOCKED_CENTRAL_USER_PATHS = new Set([
  "/api/internal/central-user-manager/v1/health",
  "/api/internal/central-user-manager/v1/operations",
  "/api/_worker/central-user-manager",
]);

export function blockPublicCentralUserManagerRequest(request) {
  return BLOCKED_CENTRAL_USER_PATHS.has(new URL(request.url).pathname)
    ? new Response(null, { status: 404 })
    : null;
}
