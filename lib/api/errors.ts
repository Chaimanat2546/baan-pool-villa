/**
 * Builds a shared JSON error response for public API routes and logs the
 * underlying error for server-side diagnostics.
 *
 * @param errorMessage - The public-facing error message to return.
 * @param error - The underlying error or thrown value to log.
 * @param status - The HTTP status code to return. Defaults to `502`.
 * @returns A JSON error response for the public API route.
 */
export function publicApiErrorResponse(
  errorMessage: string,
  error: unknown,
  status = 502,
) {
  console.error(errorMessage, error);

  return Response.json({ error: errorMessage }, { status });
}
