import { NextResponse, type NextRequest } from "next/server";
import { getMergePreview } from "../../../lib/mergePreview";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

const positiveBigintPattern = /^[1-9]\d*$/;

function parsePositiveBigint(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !positiveBigintPattern.test(value)) {
    return null;
  }

  return value;
}

function unauthorizedResponse() {
  return new NextResponse("401 Unauthorized", { status: 401 });
}

function badRequestResponse(message: string) {
  return new NextResponse(message, { status: 400 });
}

function redirectToPreview({
  request,
  token,
  canonicalId,
  candidateId,
  errorCode,
}: {
  request: NextRequest;
  token: string;
  canonicalId: string;
  candidateId: string;
  errorCode: "unsafe" | "failed";
}) {
  const redirectUrl = new URL("/admin/duplicates/merge-preview", request.url);
  redirectUrl.searchParams.set("token", token);
  redirectUrl.searchParams.set("canonical", canonicalId);
  redirectUrl.searchParams.set("candidate", candidateId);
  redirectUrl.searchParams.set("merge_error", errorCode);

  return NextResponse.redirect(redirectUrl, 303);
}

export async function POST(request: NextRequest) {
  const expectedToken = process.env.ADMIN_TOKEN;
  const providedToken = request.nextUrl.searchParams.get("token") || "";

  if (!expectedToken || providedToken !== expectedToken) {
    return unauthorizedResponse();
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return badRequestResponse("Invalid merge request.");
  }

  const canonicalId = parsePositiveBigint(formData.get("canonicalId"));
  const candidateId = parsePositiveBigint(formData.get("candidateId"));

  if (!canonicalId || !candidateId) {
    return badRequestResponse("Product IDs must be positive bigint values.");
  }

  if (canonicalId === candidateId) {
    return badRequestResponse("Product IDs must be different.");
  }

  let preview;

  try {
    preview = await getMergePreview(canonicalId, candidateId);
  } catch (error) {
    console.error("Unable to recalculate merge preview before merge.", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });

    return redirectToPreview({
      request,
      token: providedToken,
      canonicalId,
      candidateId,
      errorCode: "failed",
    });
  }

  const canMerge =
    preview &&
    preview.mergePlan.summary.blocked === 0 &&
    preview.mergePlan.summary.warning === 0 &&
    preview.canonical.product.is_active === true &&
    preview.candidate.product.is_active === true &&
    preview.canonical.product.merged_into_product_id === null &&
    preview.candidate.product.merged_into_product_id === null &&
    preview.canonical.product.merged_at === null &&
    preview.candidate.product.merged_at === null;

  if (!canMerge) {
    return redirectToPreview({
      request,
      token: providedToken,
      canonicalId,
      candidateId,
      errorCode: "unsafe",
    });
  }

  const { error } = await supabaseAdmin.rpc("merge_products", {
    canonical_id: canonicalId,
    candidate_id: candidateId,
  });

  if (error) {
    console.error("Product merge RPC failed.", {
      code: error.code,
    });

    return redirectToPreview({
      request,
      token: providedToken,
      canonicalId,
      candidateId,
      errorCode: "failed",
    });
  }

  const redirectUrl = new URL("/admin/duplicates", request.url);
  redirectUrl.searchParams.set("token", providedToken);
  redirectUrl.searchParams.set("merged", "1");
  redirectUrl.searchParams.set("canonical", canonicalId);
  redirectUrl.searchParams.set("candidate", candidateId);

  return NextResponse.redirect(redirectUrl, 303);
}
