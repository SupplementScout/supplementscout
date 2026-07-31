import { NextResponse, type NextRequest } from "next/server";
import { getDuplicatePairIds } from "../../../lib/duplicates";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdminRoute } from "../../../lib/adminAuth";

const MAX_BATCH_SIZE = 100;
const MERGE_FAMILY_NOTE =
  "MERGE FAMILY – ten sam produkt, różne smaki/rozmiary/kolory";

function parsePair(value: FormDataEntryValue) {
  if (typeof value !== "string") {
    return null;
  }

  const match = value.match(/^([1-9]\d*):([1-9]\d*)$/);
  if (!match || match[1] === match[2]) {
    return null;
  }

  return getDuplicatePairIds(match[1], match[2]);
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminRoute(request);

  if (unauthorized) {
    return unauthorized;
  }

  const formData = await request.formData();
  const decision = formData.get("decision");
  const pairValues = formData.getAll("pair");

  if (
    (decision !== "separate" && decision !== "deferred") ||
    pairValues.length === 0 ||
    pairValues.length > MAX_BATCH_SIZE
  ) {
    return new NextResponse("Invalid batch decision.", { status: 400 });
  }

  const parsedPairs = pairValues.map(parsePair);
  if (parsedPairs.some((pair) => pair === null)) {
    return new NextResponse("Invalid product pair.", { status: 400 });
  }

  const now = new Date().toISOString();
  const uniquePairs = new Map(
    parsedPairs.map((pair) => [
      `${pair![0]}:${pair![1]}`,
      {
        product_a_id: pair![0],
        product_b_id: pair![1],
        decision,
        note: decision === "deferred" ? MERGE_FAMILY_NOTE : null,
        updated_at: now,
      },
    ])
  );
  const { error } = await supabaseAdmin
    .from("ignored_duplicate_product_pairs")
    .upsert(Array.from(uniquePairs.values()), {
      onConflict: "product_a_id,product_b_id",
    });

  if (error) {
    return new NextResponse("Unable to save batch decisions.", {
      status: 500,
    });
  }

  const redirectUrl = new URL("/admin/duplicates", request.url);
  redirectUrl.searchParams.set("saved", `batch-${decision}`);
  redirectUrl.searchParams.set("count", String(uniquePairs.size));

  return NextResponse.redirect(redirectUrl, 303);
}
