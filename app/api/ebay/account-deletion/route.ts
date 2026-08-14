import {
  MAX_BODY_BYTES,
  assertEndpointRequest,
  generateChallengeResponse,
  processDeletionNotification,
  verifyNotificationSignature,
} from "@/lib/ebay-account-deletion";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStoreHeaders = { "Cache-Control": "no-store", "Content-Type": "application/json" };

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
  if (!process.env.EBAY_CLIENT_ID || !process.env.EBAY_CLIENT_SECRET) {
    return Response.json({ error: "Endpoint unavailable" }, { status: 503, headers: noStoreHeaders });
  }
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
    const valid = await verifyNotificationSignature(rawBody, signature, {
      client_id: process.env.EBAY_CLIENT_ID,
      client_secret: process.env.EBAY_CLIENT_SECRET,
    });
    if (!valid) return new Response(null, { status: 412, headers: noStoreHeaders });
    processDeletionNotification(JSON.parse(rawBody));
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Invalid JSON" }, { status: 400, headers: noStoreHeaders });
    }
    if (error instanceof Error && /X-EBAY-SIGNATURE|notification body|endpoint URL mismatch/.test(error.message)) {
      return new Response(null, { status: 412, headers: noStoreHeaders });
    }
    return Response.json({ error: "Temporary verification failure" }, { status: 503, headers: noStoreHeaders });
  }
}
