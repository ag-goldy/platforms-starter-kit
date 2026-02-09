'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, Loader2 } from 'lucide-react';
import type { KbArticle, KbCategory } from '@/db/schema';

interface ArticleFormProps {
  orgId: string;
  subdomain: string;
  categories: KbCategory[];
  initialData?: KbArticle | null;
  onSuccess?: (article: KbArticle) => void;
  onCancel?: () => void;
}

export function ArticleForm({
  orgId,
  subdomain,
  categories,
  initialData,
  onSuccess,
  onCancel,
}: ArticleFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  
  const [formState, setFormState] = useState({
    title: initialData?.title || '',
    slug: initialData?.slug || '',
    content: initialData?.content || '',
    excerpt: initialData?.excerpt || '',
    categoryId: initialData?.categoryId || '',
    status: initialData?.status || 'draft',
    visibility: initialData?.visibility || 'public',
    tags: initialData?.tags || [],
  });

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 100);
  };

  const handleTitleChange = (value: string) => {
    setFormState((prev) => ({
      ...prev,
      title: value,
      // Auto-generate slug if not manually set and not editing
      slug: !initialData && !prev.slug ? generateSlug(value) : prev.slug,
    }));
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const trimmed = tagInput.trim();
      if (trimmed && !formState.tags.includes(trimmed)) {
        setFormState((prev) => ({
          ...prev,
          tags: [...prev.tags, trimmed],
        }));
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormState((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Validation
      if (!formState.title.trim()) {
        throw new Error('Title is required');
      }
      if (!formState.slug.trim()) {
        throw new Error('Slug is required');
      }
      if (!formState.content.trim()) {
        throw new Error('Content is required');
      }

      const payload = {
        orgId,
        title: formState.title.trim(),
        slug: formState.slug.trim(),
        content: formState.content.trim(),
        excerpt: formState.excerpt.trim() || null,
        categoryId: formState.categoryId || null,
        status: formState.status,
        visibility: formState.visibility,
        tags: formState.tags,
      };

      const url = initialData 
        ? `/api/kb/articles/${initialData.id}` 
        : '/api/kb/articles';
      
      const method = initialData ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save article');
      }

      if (onSuccess) {
        onSuccess(data.article);
      } else {
        router.push(`/s/${subdomain}/kb/${data.article.slug}`);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{initialData ? 'Edit Article' : 'Create Article'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formState.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Article title"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Slug *</Label>
            <Input
              id="slug"
              value={formState.slug}
              onChange={(e) => setFormState((prev) => ({ ...prev, slug: e.target.value }))}
              placeholder="article-url-slug"
              required
            />
            <p className="text-xs text-muted-foreground">
              Used in the URL: /s/{subdomain}/kb/{formState.slug || 'your-slug'}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formState.categoryId || 'none'}
                onValueChange={(value) =>
                  setFormState((prev) => ({ ...prev, categoryId: value === 'none' ? '' : value }))
                }
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Uncategorized</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formState.status}
                onValueChange={(value: 'draft' | 'published' | 'archived') =>
                  setFormState((prev) => ({ ...prev, status: value }))
                }
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="visibility">Visibility</Label>
            <Select
              value={formState.visibility}
              onValueChange={(value: 'public' | 'internal' | 'agents_only') =>
                setFormState((prev) => ({ ...prev, visibility: value }))
              }
            >
              <SelectTrigger id="visibility">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public - Anyone can view</SelectItem>
                <SelectItem value="internal">Internal - Organization members only</SelectItem>
                <SelectItem value="agents_only">Agents Only - Support agents only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="excerpt">Excerpt</Label>
            <Textarea
              id="excerpt"
              value={formState.excerpt}
              onChange={(e) => setFormState((prev) => ({ ...prev, excerpt: e.target.value }))}
              placeholder="Brief summary of the article (shown in search results)"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Content *</Label>
            <Textarea
              id="content"
              value={formState.content}
              onChange={(e) => setFormState((prev) => ({ ...prev, content: e.target.value }))}
              placeholder="Article content (Markdown supported)"
              rows={12}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">Tags</Label>
            <Input
              id="tags"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              placeholder="Add tags (press Enter or comma to add)"
            />
            {formState.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formState.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 hover:text-red-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {initialData ? 'Update Article' : 'Create Article'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
