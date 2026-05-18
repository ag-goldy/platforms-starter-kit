import { type NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

/**
 * Resolve organization ID by slug
 */
async function resolveOrgBySlug(slug: string): Promise<{
  id: string;
  subdomain: string;
  isActive: boolean;
  deletedAt: Date | null;
} | null> {
  try {
    const sql = neon(process.env.DATABASE_URL || "");
    const result = await sql`
      SELECT id, subdomain, is_active AS "isActive", deleted_at AS "deletedAt"
      FROM organizations
      WHERE slug = ${slug} OR subdomain = ${slug}
      LIMIT 1
    `;
    if (result.length === 0) return null;
    return result[0] as {
      id: string;
      subdomain: string;
      isActive: boolean;
      deletedAt: Date | null;
    };
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static files, Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|css|js|woff|woff2|ttf|eot)$/)
  ) {
    return NextResponse.next();
  }

  // Define root/platform routes that do not have a slug
  const rootRoutes = [
    "/",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/magic",
    "/passkey/register",
  ];
  const platformPrefixes = ["/admin", "/api"];
  const appPrefixes = ["/app", "/s"];

  const isRootRoute = rootRoutes.includes(pathname);
  const isPlatformRoute = platformPrefixes.some((prefix) =>
    pathname.startsWith(prefix),
  );

  if (
    isRootRoute ||
    isPlatformRoute ||
    appPrefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  ) {
    const response = NextResponse.next();
    addSecurityHeaders(response);
    return response;
  }

  // If not a root or platform route, it must be a tenant route: /{slug}/...
  const pathParts = pathname.split("/").filter(Boolean);
  if (pathParts.length > 0) {
    const slug = pathParts[0];

    // Check if the slug is reserved or matches something else
    if (slug === "kb-public") {
      const response = NextResponse.next();
      addSecurityHeaders(response);
      return response;
    }

    const org = await resolveOrgBySlug(slug);

    if (!org) {
      return NextResponse.rewrite(new URL("/404", request.url));
    }

    if (pathParts[1] === "portal") {
      const rest = pathParts.slice(2).join("/");
      const redirectPath = rest
        ? `/s/${org.subdomain}/${rest}`
        : `/s/${org.subdomain}`;
      return NextResponse.redirect(new URL(redirectPath, request.url));
    }

    if ((!org.isActive || org.deletedAt) && !pathname.endsWith("/disabled")) {
      return NextResponse.redirect(new URL(`/${slug}/disabled`, request.url));
    }

    const response = NextResponse.next();
    // Inject headers for downstream
    response.headers.set("x-org-id", org.id);
    response.headers.set("x-org-slug", slug);
    addSecurityHeaders(response);
    return response;
  }

  // Unhandled routes
  return NextResponse.rewrite(new URL("/404", request.url));
}

function addSecurityHeaders(response: NextResponse) {
  const securityHeaders = {
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' blob: data: https:",
      "font-src 'self'",
      "connect-src 'self' wss: https:",
      "frame-ancestors 'none'",
    ].join("; "),
  };

  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
}

export const config = {
  matcher: ["/((?!api|_next|static|.*\..*).*)"],
};
