import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import {
  ADMIN_SESSION_COOKIE_NAME,
  validateAdminSessionCookieValue,
} from "./adminAuthCore";

function validateCookieValue(value: string | undefined) {
  return validateAdminSessionCookieValue(value, {
    secret: process.env.ADMIN_SESSION_SECRET,
  }).ok;
}

export async function hasAdminSession() {
  const cookieStore = await cookies();

  return validateCookieValue(cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value);
}

export async function requireAdminPage() {
  if (!(await hasAdminSession())) {
    redirect("/admin/login");
  }
}

export function hasAdminRequestSession(request: NextRequest) {
  return validateCookieValue(request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value);
}

export function requireAdminRoute(request: NextRequest) {
  if (!hasAdminRequestSession(request)) {
    return new Response("401 Unauthorized", { status: 401 });
  }

  return null;
}
