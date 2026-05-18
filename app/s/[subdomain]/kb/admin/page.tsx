"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, FolderTree, Pencil } from "lucide-react";

type Org = { id: string; subdomain: string; name: string; slug: string };

type Article = {
  id: string;
  title: string;
  slug: string;
  status: string;
  visibility: string;
  updatedAt: string;
};

export default function PortalKBAdminPage() {
  const params = useParams();
  const subdomain = params?.subdomain as string;

  const [org, setOrg] = useState<Org | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = role === "CUSTOMER_ADMIN";

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const orgRes = await fetch(`/api/org/${subdomain}`);
        if (!orgRes.ok) throw new Error("Org not found");
        const orgData = (await orgRes.json()) as Org;
        setOrg(orgData);

        const membershipRes = await fetch(`/api/user/membership/${orgData.id}`);
        if (membershipRes.ok) {
          const membershipData = await membershipRes.json();
          setRole(membershipData.role || null);
        } else {
          setRole(null);
        }

        const listRes = await fetch(
          `/api/kb/articles?org=${subdomain}&includeInternal=true&status=all&visibility=all&sortBy=updatedAt&sortOrder=desc`,
        );
        if (listRes.ok) {
          const data = await listRes.json();
          setArticles((data.articles || []) as Article[]);
        } else {
          setArticles([]);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [subdomain]);

  const statusColors = useMemo(() => {
    return {
      draft: "bg-stone-100 text-stone-700",
      published: "bg-emerald-100 text-emerald-800",
      archived: "bg-red-100 text-red-800",
      pending_review: "bg-amber-100 text-amber-800",
    } as Record<string, string>;
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
      </div>
    );
  }

  if (!org || !isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Knowledge Base Admin</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-stone-600">
          Admin access required.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">
            Knowledge Base Admin
          </h1>
          <p className="mt-1 text-sm text-stone-600">{org.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/s/${subdomain}/kb/admin/categories`}>
            <Button variant="outline">
              <FolderTree className="h-4 w-4 mr-2" />
              Categories
            </Button>
          </Link>
          <Link href={`/s/${subdomain}/kb/admin/articles/new`}>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Article
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Articles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {articles.length === 0 ? (
            <div className="text-sm text-stone-600">No articles yet.</div>
          ) : (
            <div className="space-y-2">
              {articles.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-medium text-stone-900 truncate">
                        {a.title}
                      </div>
                      <Badge
                        className={
                          statusColors[a.status] ||
                          "bg-stone-100 text-stone-700"
                        }
                      >
                        {a.status}
                      </Badge>
                      <Badge variant="outline">{a.visibility}</Badge>
                    </div>
                    <div className="text-xs text-stone-500 truncate">
                      {a.slug}
                    </div>
                  </div>
                  <Link href={`/s/${subdomain}/kb/admin/articles/${a.id}`}>
                    <Button variant="ghost" size="sm">
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
