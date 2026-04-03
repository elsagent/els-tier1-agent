import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // No auth — all routes are public
  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
