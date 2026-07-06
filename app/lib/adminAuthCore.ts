import { createHmac, createHash, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE_NAME = "__ss_admin_session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
export const ADMIN_SESSION_VERSION = 1;

type AdminSessionPayload = {
  v: number;
  exp: number;
};

export type AdminSessionValidationResult =
  | { ok: true; payload: AdminSessionPayload }
  | {
      ok: false;
      reason:
        | "missing_secret"
        | "missing_cookie"
        | "malformed_cookie"
        | "bad_signature"
        | "bad_payload"
        | "wrong_version"
        | "expired";
    };

function base64UrlEncode(value: Buffer | string) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url");
}

function requireSessionSecret(secret: string | undefined) {
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET is required for admin sessions.");
  }

  return secret;
}

function signPayload(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftDigest = createHash("sha256").update(left).digest();
  const rightDigest = createHash("sha256").update(right).digest();

  return timingSafeEqual(leftDigest, rightDigest);
}

export function isAdminPasswordValid(input: string, expected: string | undefined) {
  if (!expected) {
    return false;
  }

  return safeEqual(input, expected);
}

export function createAdminSessionCookieValue(input: {
  secret: string | undefined;
  nowMs?: number;
}) {
  const secret = requireSessionSecret(input.secret);
  const nowMs = input.nowMs ?? Date.now();
  const payload: AdminSessionPayload = {
    v: ADMIN_SESSION_VERSION,
    exp: nowMs + ADMIN_SESSION_MAX_AGE_SECONDS * 1000,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signPayload(encodedPayload, secret);

  return `${encodedPayload}.${signature}`;
}

export function validateAdminSessionCookieValue(
  value: string | undefined,
  input: {
    secret: string | undefined;
    nowMs?: number;
  }
): AdminSessionValidationResult {
  if (!input.secret) {
    return { ok: false, reason: "missing_secret" };
  }

  if (!value) {
    return { ok: false, reason: "missing_cookie" };
  }

  const [encodedPayload, signature, extra] = value.split(".");

  if (!encodedPayload || !signature || extra !== undefined) {
    return { ok: false, reason: "malformed_cookie" };
  }

  const expectedSignature = signPayload(encodedPayload, input.secret);

  if (!safeEqual(signature, expectedSignature)) {
    return { ok: false, reason: "bad_signature" };
  }

  let payload: AdminSessionPayload;

  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload).toString("utf8"));
  } catch {
    return { ok: false, reason: "bad_payload" };
  }

  if (
    typeof payload !== "object" ||
    payload === null ||
    payload.v !== ADMIN_SESSION_VERSION ||
    typeof payload.exp !== "number"
  ) {
    return payload?.v === ADMIN_SESSION_VERSION
      ? { ok: false, reason: "bad_payload" }
      : { ok: false, reason: "wrong_version" };
  }

  if (payload.exp <= (input.nowMs ?? Date.now())) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true, payload };
}

export function getAdminSessionCookieOptions(isProduction: boolean) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/admin",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  };
}

export function isAdminPathProtected(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export function isAdminLoginPath(pathname: string) {
  return pathname === "/admin/login" || pathname === "/admin/login/session";
}

export function getAdminAccessDecision(input: {
  pathname: string;
  method: string;
  cookieValue: string | undefined;
  secret: string | undefined;
}) {
  if (!isAdminPathProtected(input.pathname) || isAdminLoginPath(input.pathname)) {
    return "allow" as const;
  }

  const session = validateAdminSessionCookieValue(input.cookieValue, {
    secret: input.secret,
  });

  if (session.ok) {
    return "allow" as const;
  }

  return input.method === "GET" || input.method === "HEAD"
    ? ("redirect" as const)
    : ("unauthorized" as const);
}
