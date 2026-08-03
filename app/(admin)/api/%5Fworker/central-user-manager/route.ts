import { executeCentralUserManagerRpc } from "@/lib/central-user-manager/rpc-service";

export async function POST(request: Request) {
  let input: unknown;

  try {
    input = await request.json();
  } catch {
    input = null;
  }

  return Response.json(await executeCentralUserManagerRpc(input));
}
