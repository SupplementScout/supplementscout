import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_SESSION_COOKIE_NAME,
  getAdminAccessDecision,
} from "./app/lib/adminAuthCore";

export function proxy(request: NextRequest) {
  const decision = getAdminAccessDecision({
    pathname: request.nextUrl.pathname,
    method: request.method,
    cookieValue: request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value,
    secret: process.env.ADMIN_SESSION_SECRET,
  });

  if (decision === "allow") {
    return NextResponse.next();
  }

  if (decision === "unauthorized") {
    return new Response("401 Unauthorized", { status: 401 });
  }

  return NextResponse.redirect(new URL("/admin/login", request.url));
}

export const config = {
  matcher: "/admin/:path*",
};
