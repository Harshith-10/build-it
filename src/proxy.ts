import { type NextRequest, NextResponse } from "next/server";

export async function proxy(request: NextRequest) {
  const sessionCookie = request.cookies.get("better-auth.session_token");
  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/auth/sign-in", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/exams/:path*", "/dashboard/:path*"],
};
