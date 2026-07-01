import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

function isPositiveInteger(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return false;
  }

  const number = Number(value);

  return Number.isInteger(number) && number > 0;
}

function unauthorizedResponse() {
  return new NextResponse("401 Unauthorized", { status: 401 });
}

function badRequestResponse(message: string) {
  return new NextResponse(message, { status: 400 });
}

export async function POST(request: NextRequest) {
  const expectedToken = process.env.ADMIN_TOKEN;
  const providedToken = request.nextUrl.searchParams.get("token") || "";

  if (!expectedToken || providedToken !== expectedToken) {
    return unauthorizedResponse();
  }

  const formData = await request.formData();
  const productAIdValue = formData.get("productAId");
  const productBIdValue = formData.get("productBId");

  if (
    !isPositiveInteger(productAIdValue) ||
    !isPositiveInteger(productBIdValue)
  ) {
    return badRequestResponse("Product IDs must be positive integers.");
  }

  const rawProductAId = Number(productAIdValue);
  const rawProductBId = Number(productBIdValue);

  if (rawProductAId === rawProductBId) {
    return badRequestResponse("Product IDs must be different.");
  }

  const productAId = Math.min(rawProductAId, rawProductBId);
  const productBId = Math.max(rawProductAId, rawProductBId);

  const { error } = await supabaseAdmin
    .from("ignored_duplicate_product_pairs")
    .upsert(
      {
        product_a_id: productAId,
        product_b_id: productBId,
      },
      {
        onConflict: "product_a_id,product_b_id",
      }
    );

  if (error) {
    return new NextResponse("Unable to ignore duplicate pair.", {
      status: 500,
    });
  }

  const redirectUrl = new URL("/admin/duplicates", request.url);
  redirectUrl.searchParams.set("token", providedToken);

  return NextResponse.redirect(redirectUrl, 303);
}
