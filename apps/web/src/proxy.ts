import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "ecomove_session";

/** Optimistic check only: real authorization happens in the data access layer on the server. */
export function proxy(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico).*)"],
};
