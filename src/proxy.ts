import { type NextRequest, NextResponse } from "next/server";

export async function proxy(request: NextRequest) {
  // Determine if we are running in the secure production environment
  const isProduction = process.env.NODE_ENV === "production";

  // Better-Auth automatically applies this prefix when served over HTTPS
  const cookieName = isProduction
    ? "__Secure-better-auth.session_token"
    : "better-auth.session_token";

  const sessionCookie = request.cookies.get(cookieName);

  if (!sessionCookie) {
    // Pass the original URL as a 'callbackURL' so you can redirect the user
    // back to the page they were trying to access after they sign in.
    const signInUrl = new URL("/auth/sign-in", request.url);
    signInUrl.searchParams.set("callbackURL", request.nextUrl.pathname);

    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Protects all routes under /exams, /dashboard, and /faculty
  matcher: ["/exams/:path*", "/dashboard/:path*", "/faculty/:path*"],
};
