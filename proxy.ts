import { NextResponse, type NextRequest } from "next/server";

function unauthorizedResponse() {
  return new NextResponse(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="robots" content="noindex, nofollow" />
    <title>401 Unauthorized</title>
  </head>
  <body style="font-family: Arial, sans-serif; margin: 48px; color: #18181b;">
    <main>
      <h1>401 Unauthorized</h1>
      <p>Admin access requires a valid token.</p>
    </main>
  </body>
</html>`,
    {
      status: 401,
      headers: {
        "content-type": "text/html; charset=utf-8",
      },
    }
  );
}

export function proxy(request: NextRequest) {
  const expectedToken = process.env.ADMIN_TOKEN;
  const providedToken = request.nextUrl.searchParams.get("token");

  if (!expectedToken || providedToken !== expectedToken) {
    return unauthorizedResponse();
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/admin/:path*",
};
