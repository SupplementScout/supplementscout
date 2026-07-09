import { type NextRequest } from "next/server";
import { getSearchSuggestions } from "../../lib/products";

export const dynamic = "force-dynamic";

function parseSuggestionLimit(value: string | null) {
  if (!value || !/^[1-9][0-9]*$/.test(value)) {
    return undefined;
  }

  const limit = Number.parseInt(value, 10);

  return Number.isSafeInteger(limit) ? limit : undefined;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") || "";
  const limit = parseSuggestionLimit(request.nextUrl.searchParams.get("limit"));
  const suggestions = await getSearchSuggestions(query, limit);

  return Response.json(suggestions, {
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}
