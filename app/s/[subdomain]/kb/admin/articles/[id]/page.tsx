'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowLeft, Trash2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArticleEditor } from '@/components/kb/article-editor';
import { useToast } from '@/components/ui/toast';

type Org = { id: string; subdomain: string; name: string; slug: string };
type Category = { id: string; name: string };
type Article = {
  id: string;
  title: string;
  content: string;
  contentType: string;
  categoryId: string | null;
  status: 'draft' | 'published' | 'archived' | 'pending_review';
  visibility: 'public' | 'org_only' | 'internal' | 'agents_only';
};

export default function PortalKBEditArticlePage() {
  const params = useParams();
  const subdomain = params?.subdomain as string;
  const articleId = params?.id as string;
  const router = useRouter();
  const { success, error: showError } = useToast();

  const [org, setOrg] = useState<Org | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isAdmin = role === 'CUSTOMER_ADMIN';

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const orgRes = await fetch(`/api/org/${subdomain}`);
        if (!orgRes.ok) throw new Error('Org not found');
        const orgData = (await orgRes.json()) as Org;
        setOrg(orgData);

        const membershipRes = await fetch(`/api/user/membership/${orgData.id}`);
        if (membershipRes.ok) {
          const membershipData = await membershipRes.json();
          setRole(membershipData.role || null);
        } else {
          setRole(null);
        }

        const [catRes, articleRes] = await Promise.all([
          fetch(`/api/kb/categories?orgId=${orgData.id}&includeInternal=true`),
          fetch(`/api/kb/articles/${articleId}`),
        ]);

        if (catRes.ok) {
          const data = await catRes.json();
          setCategories((data.categories || []) as Category[]);
        } else {
          setCategories([]);
        }

        if (articleRes.ok) {
          const data = await articleRes.json();
          setArticle(data.article as Article);
        } else {
          setArticle(null);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [subdomain, articleId]);

  const canSave = useMemo(() => {
    return !!org && !!article && isAdmin && !saving && article.title.trim().length > 2 && article.content.trim().length > 10;
  }, [org, article, isAdmin, saving]);

  async function handleSave() {
    if (!article) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/kb/articles/${article.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: article.title,
          content: article.content,
          contentType: article.contentType,
          categoryId: article.categoryId,
          status: article.status,
          visibility: article.visibility,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save article');
      }

      success('Article updated');
      router.push(`/s/${subdomain}/kb/admin`);
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Failed to save article');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!article) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/kb/articles/${article.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete article');
      }
      success('Article deleted');
      router.push(`/s/${subdomain}/kb/admin`);
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Failed to delete article');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
      </div>
    );
  }

  if (!org || !isAdmin || !article) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Edit Article</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-stone-600">Admin access required.</CardContent>
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
          <h1 className="text-2xl font-bold text-stone-900">Edit Article</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
            Delete
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={article.title}
              onChange={(e) => setArticle({ ...article, title: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={article.categoryId || 'none'}
                onValueChange={(v) => setArticle({ ...article, categoryId: v === 'none' ? null : v })}
              >
                <SelectTrigger>
                  <SelectValue />
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
                value={article.status}
                onValueChange={(v) => setArticle({ ...article, status: v as Article['status'] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Visibility</Label>
              <Select
                value={article.visibility}
                onValueChange={(v) => setArticle({ ...article, visibility: v as Article['visibility'] })}
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
            <ArticleEditor
              content={article.contentType === 'html' ? article.content : ''}
              onChange={(value) => setArticle({ ...article, contentType: 'html', content: value })}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

