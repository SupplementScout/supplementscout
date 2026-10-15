import { loadMySupplementsCurrent, type MySupplementsCurrentRequestItem } from "../../../lib/mySupplementsCurrent.server";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 16_384;
const MAX_ITEMS = 30;

function parseItems(value: unknown): MySupplementsCurrentRequestItem[] | null {
  if (typeof value !== "object" || value === null || !("items" in value) || !Array.isArray(value.items)) return null;
  if (value.items.length > MAX_ITEMS) return null;
  const items: MySupplementsCurrentRequestItem[] = [];
  const keys = new Set<string>();
  for (const item of value.items) {
    if (
      typeof item !== "object" ||
      item === null ||
      !("productId" in item) ||
      !("variantId" in item) ||
      typeof item.productId !== "string" ||
      typeof item.variantId !== "string" ||
      !/^[1-9][0-9]*$/.test(item.productId) ||
      !/^[1-9][0-9]*$/.test(item.variantId)
    ) return null;
    const key = `${item.productId}:${item.variantId}`;
    if (keys.has(key)) return null;
    keys.add(key);
    items.push({ productId: item.productId, variantId: item.variantId });
  }
  return items;
}

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}

export async function POST(request: Request) {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) return json({ error: "Request too large" }, 413);

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return json({ error: "Request too large" }, 413);

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: "Invalid request" }, 400);
  }
  const items = parseItems(body);
  if (!items) return json({ error: "Invalid request" }, 400);

  try {
    return json({ items: await loadMySupplementsCurrent(items) });
  } catch {
    return json({ error: "Current data is temporarily unavailable" }, 503);
  }
}

