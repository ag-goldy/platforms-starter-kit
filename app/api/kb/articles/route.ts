import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { kbArticles, kbCategories, organizations } from "@/db/schema";
import { eq, and, desc, asc, like, or, isNull } from "drizzle-orm";
import {
  requireAuth,
  requireInternalRole,
  requireOrgMemberRole,
} from "@/lib/auth/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { generateKbKey } from "@/lib/kb/keys";

// GET /api/kb/articles - List articles
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgSlug = searchParams.get("org");
    const categorySlug = searchParams.get("category");
    const search = searchParams.get("search");
    const includeInternal = searchParams.get("includeInternal") === "true";
    const statusParam = searchParams.get("status");
    const visibilityParam = searchParams.get("visibility");
    const status =
      statusParam && statusParam !== "all"
        ? statusParam
        : includeInternal
          ? null
          : "published";
    const visibility =
      visibilityParam && visibilityParam !== "all"
        ? visibilityParam
        : includeInternal
          ? null
          : "public";
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";
    const global = searchParams.get("global") === "true";

    // Build base conditions
    const conditions: ReturnType<typeof and>[] = [];
    let orgId: string | null = null;

    if (global) {
      // Fetch global articles (no org assigned)
      conditions.push(isNull(kbArticles.orgId));
    } else if (orgSlug) {
      // Get organization
      const org = await db.query.organizations.findFirst({
        where: eq(organizations.subdomain, orgSlug),
      });

      if (!org) {
        return NextResponse.json(
          { error: "Organization not found" },
          { status: 404 },
        );
      }
      orgId = org.id;
      conditions.push(eq(kbArticles.orgId, orgId));
    } else {
      return NextResponse.json(
        { error: "Organization slug or global flag required" },
        { status: 400 },
      );
    }

    if (includeInternal) {
      await requireAuth();
      if (global) {
        await requireInternalRole();
      } else if (orgId) {
        try {
          await requireOrgMemberRole(orgId, ["CUSTOMER_ADMIN"]);
        } catch {
          await requireInternalRole();
        }
      }
    }

    if (status) {
      conditions.push(eq(kbArticles.status, status));
    }

    if (visibility) {
      conditions.push(eq(kbArticles.visibility, visibility));
    }

    // Add category filter
    if (categorySlug) {
      if (global) {
        // For global mode, look up category by slug only (no org filter)
        const category = await db.query.kbCategories.findFirst({
          where: and(
            isNull(kbCategories.orgId),
            eq(kbCategories.slug, categorySlug),
          ),
        });
        if (category) {
          conditions.push(eq(kbArticles.categoryId, category.id));
        }
      } else if (orgId) {
        // For org-specific mode, look up by org and slug
        const category = await db.query.kbCategories.findFirst({
          where: and(
            eq(kbCategories.orgId, orgId),
            eq(kbCategories.slug, categorySlug),
          ),
        });
        if (category) {
          conditions.push(eq(kbArticles.categoryId, category.id));
        }
      }
    }

    // Add search filter
    if (search) {
      const searchTerm = `%${search}%`;
      conditions.push(
        or(
          like(kbArticles.title, searchTerm),
          like(kbArticles.content, searchTerm),
          like(kbArticles.excerpt, searchTerm),
        )!,
      );
    }

    // Determine sort order
    const orderBy =
      sortOrder === "asc"
        ? asc(
            sortBy === "title"
              ? kbArticles.title
              : sortBy === "viewCount"
                ? kbArticles.viewCount
                : kbArticles.createdAt,
          )
        : desc(
            sortBy === "title"
              ? kbArticles.title
              : sortBy === "viewCount"
                ? kbArticles.viewCount
                : kbArticles.createdAt,
          );

    console.log("[KB Articles API] Query conditions:", conditions.length);
    console.log("[KB Articles API] Global mode:", global);

    const articles = await db.query.kbArticles.findMany({
      where: and(...conditions),
      orderBy: [orderBy],
      with: {
        category: true,
        author: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    console.log("[KB Articles API] Found articles:", articles.length);

    return NextResponse.json({ articles });
  } catch (error) {
    console.error("Failed to fetch articles:", error);
    return NextResponse.json(
      { error: "Failed to fetch articles" },
      { status: 500 },
    );
  }
}

// POST /api/kb/articles - Create a new article
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    // 20 article creations per hour per user
    const rl = await rateLimit(`kb-articles:post:${user.user.id}`, {
      maxRequests: 20,
      windowSeconds: 3600,
    });
    if (!rl.allowed)
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 },
      );

    const body = await request.json();

    const {
      orgId,
      categoryId,
      title,
      content,
      contentType = "markdown",
      excerpt,
      status = "draft",
      visibility = "public",
      tags = [],
    } = body;

    // Validate required fields (orgId can be null for global articles)
    if (!title || !content) {
      return NextResponse.json(
        { error: "Missing required fields: title, content" },
        { status: 400 },
      );
    }

    if (orgId) {
      try {
        await requireOrgMemberRole(orgId, ["CUSTOMER_ADMIN"]);
      } catch {
        await requireInternalRole();
      }
    } else {
      await requireInternalRole();
    }

    // Generate unique KB ID
    const kbId = await generateKbKey();

    // Create article with KB ID as slug
    const [article] = await db
      .insert(kbArticles)
      .values({
        orgId,
        categoryId: categoryId || null,
        title,
        slug: kbId,
        content,
        contentType,
        excerpt: excerpt || null,
        status,
        visibility,
        authorId: user.user.id,
        tags,
        publishedAt: status === "published" ? new Date() : null,
      })
      .returning();

    return NextResponse.json({ article }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "AuthorizationError") {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("Failed to create article:", error);
    return NextResponse.json(
      { error: "Failed to create article" },
      { status: 500 },
    );
  }
}
