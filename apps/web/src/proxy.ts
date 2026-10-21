import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "ecomove_session";

/**
 * Optimistic check for protected `/painel` routes only.
 * The public landing page (`/`) and `/login` remain accessible to everyone;
 * full role verification runs in the server Data Access Layer (`src/lib/dal.ts`).
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/painel/:path*"],
};
