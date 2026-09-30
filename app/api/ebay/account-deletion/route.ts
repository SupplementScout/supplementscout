import { after } from "next/server";
import {
  DIAGNOSTIC_CODES,
  MAX_BODY_BYTES,
  assertEndpointRequest,
  decodeSignatureHeader,
  generateChallengeResponse,
  getDiagnosticCode,
  processDeletionNotification,
  verifiedNotificationLogContext,
  verifyNotificationSignature,
} from "@/lib/ebay-account-deletion";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStoreHeaders = { "Cache-Control": "no-store", "Content-Type": "application/json" };

type VerifiedLogContext = {
  notification_id_sha256?: string;
  publish_attempt_count?: number;
};

function logDiagnosticFailure(failureCode: string, context: VerifiedLogContext = {}) {
  const diagnostic: Record<string, string | number> = { failure_code: failureCode };
  if (/^[0-9a-f]{64}$/.test(context.notification_id_sha256 || "")) {
    diagnostic.notification_id_sha256 = context.notification_id_sha256!;
  }
  if (Number.isSafeInteger(context.publish_attempt_count) && context.publish_attempt_count! >= 0) {
    diagnostic.publish_attempt_count = context.publish_attempt_count!;
  }
  console.error("eBay account-deletion diagnostic", diagnostic);
}

export async function GET(request: Request) {
  if (!process.env.EBAY_NOTIFICATION_VERIFICATION_TOKEN) {
    return Response.json({ error: "Endpoint unavailable" }, { status: 503, headers: noStoreHeaders });
  }
  try {
    assertEndpointRequest(request.url);
    const challengeCode = new URL(request.url).searchParams.get("challenge_code");
    const challengeResponse = generateChallengeResponse(
      challengeCode,
      process.env.EBAY_NOTIFICATION_VERIFICATION_TOKEN,
    );
    return Response.json({ challengeResponse }, { status: 200, headers: noStoreHeaders });
  } catch {
    return Response.json({ error: "Invalid eBay endpoint challenge" }, { status: 400, headers: noStoreHeaders });
  }
}

export async function POST(request: Request) {
  try {
    assertEndpointRequest(request.url);
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > MAX_BODY_BYTES) {
      return Response.json({ error: "Payload too large" }, { status: 413, headers: noStoreHeaders });
    }
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
      return Response.json({ error: "Payload too large" }, { status: 413, headers: noStoreHeaders });
    }
    const signature = request.headers.get("x-ebay-signature");
    decodeSignatureHeader(signature);
    const payload = JSON.parse(rawBody);
    const config = {
      client_id: process.env.EBAY_CLIENT_ID,
      client_secret: process.env.EBAY_CLIENT_SECRET,
    };
    after(async () => {
      let valid = false;
      try {
        valid = await verifyNotificationSignature(rawBody, signature, config);
      } catch (error) {
        logDiagnosticFailure(
          getDiagnosticCode(error, DIAGNOSTIC_CODES.SIGNATURE_REJECTED)
        );
        return;
      }
      if (!valid) {
        logDiagnosticFailure(DIAGNOSTIC_CODES.SIGNATURE_REJECTED);
        return;
      }
      const verifiedContext = verifiedNotificationLogContext(payload);
      try {
        processDeletionNotification(payload);
      } catch (error) {
        logDiagnosticFailure(getDiagnosticCode(error), verifiedContext);
      }
    });
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Invalid JSON" }, { status: 400, headers: noStoreHeaders });
    }
    if (error instanceof Error && /X-EBAY-SIGNATURE|notification body|endpoint URL mismatch/.test(error.message)) {
      return new Response(null, { status: 412, headers: noStoreHeaders });
    }
    return Response.json({ error: "Invalid eBay notification" }, { status: 400, headers: noStoreHeaders });
  }
}
