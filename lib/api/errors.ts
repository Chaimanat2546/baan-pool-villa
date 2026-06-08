export function publicApiErrorResponse(
  errorMessage: string,
  error: unknown,
  status = 502,
) {
  console.error(errorMessage, error);

  return Response.json({ error: errorMessage }, { status });
}
