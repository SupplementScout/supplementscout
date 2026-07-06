import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_SESSION_COOKIE_NAME,
  createAdminSessionCookieValue,
  getAdminSessionCookieOptions,
  isAdminPasswordValid,
} from "../../../lib/adminAuthCore";

function loginRedirect(request: NextRequest, error = false) {
  const url = new URL(error ? "/admin/login?error=1" : "/admin/duplicates", request.url);

  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const password = formData.get("password");

  if (
    typeof password !== "string" ||
    !isAdminPasswordValid(password, process.env.ADMIN_TOKEN)
  ) {
    return loginRedirect(request, true);
  }

  let cookieValue: string;

  try {
    cookieValue = createAdminSessionCookieValue({
      secret: process.env.ADMIN_SESSION_SECRET,
    });
  } catch {
    return loginRedirect(request, true);
  }

  const response = loginRedirect(request);
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE_NAME,
    value: cookieValue,
    ...getAdminSessionCookieOptions(process.env.NODE_ENV === "production"),
  });

  return response;
}
