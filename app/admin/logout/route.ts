import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_SESSION_COOKIE_NAME,
  getAdminSessionCookieOptions,
} from "../../lib/adminAuthCore";
import { requireAdminRoute } from "../../lib/adminAuth";

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminRoute(request);

  if (unauthorized) {
    return unauthorized;
  }

  const response = NextResponse.redirect(new URL("/admin/login", request.url), 303);
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE_NAME,
    value: "",
    ...getAdminSessionCookieOptions(process.env.NODE_ENV === "production"),
    maxAge: 0,
  });

  return response;
}
