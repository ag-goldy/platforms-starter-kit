"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArticleEditor } from "@/components/kb/article-editor";
import { useToast } from "@/components/ui/toast";

type Org = { id: string; subdomain: string; name: string; slug: string };
type Category = { id: string; name: string };

export default function PortalKBNewArticlePage() {
  const params = useParams();
  const subdomain = params?.subdomain as string;
  const router = useRouter();
  const { success, error: showError } = useToast();

  const [org, setOrg] = useState<Org | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState<string>("none");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [visibility, setVisibility] = useState<
    "public" | "org_only" | "internal"
  >("public");
  const [content, setContent] = useState("");

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

        const catRes = await fetch(
          `/api/kb/categories?orgId=${orgData.id}&includeInternal=true`,
        );
        if (catRes.ok) {
          const data = await catRes.json();
          setCategories((data.categories || []) as Category[]);
        } else {
          setCategories([]);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [subdomain]);

  const canSubmit = useMemo(() => {
    return (
      title.trim().length > 2 &&
      content.trim().length > 10 &&
      !!org &&
      isAdmin &&
      !saving
    );
  }, [title, content, org, isAdmin, saving]);

  async function handleSave() {
    if (!org) return;
    setSaving(true);
    try {
      const res = await fetch("/api/kb/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: org.id,
          title,
          content,
          contentType: "html",
          categoryId: categoryId === "none" ? null : categoryId,
          status,
          visibility,
          tags: [],
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create article");
      }

      success("Article created");
      router.push(`/s/${subdomain}/kb/admin`);
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed to create article");
    } finally {
      setSaving(false);
    }
  }

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
          <CardTitle>New Article</CardTitle>
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
        <div className="flex items-center gap-2">
          <Link href={`/s/${subdomain}/kb/admin`}>
            <Button variant="ghost">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-stone-900">New Article</h1>
        </div>
        <Button onClick={handleSave} disabled={!canSubmit}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Create
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Article title"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Uncategorized</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as "draft" | "published")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Visibility</Label>
              <Select
                value={visibility}
                onValueChange={(v) =>
                  setVisibility(v as "public" | "org_only" | "internal")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="org_only">Org Only</SelectItem>
                  <SelectItem value="internal">Internal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Content</Label>
            <ArticleEditor content={content} onChange={setContent} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
