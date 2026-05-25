import { fetchVillaDetail } from "@/lib/villas/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    const payload = await fetchVillaDetail(id);

    if (!payload) {
      return Response.json({ error: "Villa not found" }, { status: 404 });
    }

    return Response.json(payload);
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unable to load villa",
      },
      { status: 502 },
    );
  }
}
