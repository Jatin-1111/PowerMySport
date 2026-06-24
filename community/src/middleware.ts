import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const isCommunityLive = process.env.NEXT_PUBLIC_COMMUNITY_IS_LIVE !== "false";
  
  if (!isCommunityLive) {
    const path = request.nextUrl.pathname;
    
    // Rewrite all paths to root where the waitlist is shown, except the root itself
    if (path !== "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.rewrite(url);
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
