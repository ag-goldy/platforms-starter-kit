'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Loader2, X, Folder, Globe, Building2, RefreshCw, Eye, Code, FileText } from 'lucide-react';
import { useToast } from '@/components/ui/toast';

interface Organization {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  orgId: string;
  parentId: string | null;
  description: string | null;
}

interface Article {
  id: string;
  title: string;
  slug: string;
  content: string;
  contentType: 'markdown' | 'html';
  excerpt: string | null;
  categoryId: string | null;
  status: string;
  visibility: string;
  tags: string[];
  orgId: string;
}

export default function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [orgId, setOrgId] = useState('');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [isCheckingSlug, setIsCheckingSlug] = useState(false);
  const [articleId, setArticleId] = useState<string>('');
  
  const [formState, setFormState] = useState({
    title: '',
    slug: '',
    content: '',
    contentType: 'markdown' as 'markdown' | 'html',
    excerpt: '',
    categoryId: '',
    status: 'draft',
    visibility: 'public',
  });

  // Resolve params and load article data
  useEffect(() => {
    async function init() {
      const resolvedParams = await params;
      setArticleId(resolvedParams.id);
    }
    init();
  }, [params]);

  useEffect(() => {
    if (!articleId) return;
    
    async function loadArticle() {
      try {
        const response = await fetch(`/api/kb/articles/${articleId}`);
        if (!response.ok) {
          throw new Error('Failed to load article');
        }
        const data = await response.json();
        const article: Article = data.article;
        
        setFormState({
          title: article.title,
          slug: article.slug,
          content: article.content,
          contentType: article.contentType || 'markdown',
          excerpt: article.excerpt || '',
          categoryId: article.categoryId || '',
          status: article.status,
          visibility: article.visibility,
        });
        setTags(article.tags || []);
        setOrgId(article.orgId);
      } catch (error) {
        console.error('Failed to load article:', error);
        showToast('Failed to load article', 'error');
      }
    }
    loadArticle();
  }, [articleId, showToast]);

  // Fetch organizations on mount
  useEffect(() => {
    async function loadOrganizations() {
      try {
        const response = await fetch('/api/organizations');
        if (response.ok) {
          const data = await response.json();
          setOrganizations(data.organizations || []);
        }
      } catch (error) {
        console.error('Failed to load organizations:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadOrganizations();
  }, []);

  // Fetch categories when org changes
  useEffect(() => {
    async function loadCategories() {
      if (!orgId) return;
      
      setIsLoadingCategories(true);
      try {
        const response = await fetch(`/api/kb/categories?orgId=${orgId}`);
        if (response.ok) {
          const data = await response.json();
          setCategories(data.categories || []);
        }
      } catch (error) {
        console.error('Failed to load categories:', error);
      } finally {
        setIsLoadingCategories(false);
      }
    }
    loadCategories();
  }, [orgId]);

  // Generate base slug from title
  const generateBaseSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 100);
  };

  // Check if slug exists (excluding current article)
  const checkSlugUnique = useCallback(async (slug: string, orgId: string, articleId: string) => {
    if (!slug) return true;
    
    setIsCheckingSlug(true);
    setSlugError(null);
    
    try {
      const response = await fetch(`/api/kb/check-slug?slug=${slug}&orgId=${orgId}`);
      const data = await response.json();
      
      // If slug exists and it's not the current article
      if (data.exists && data.articleId !== articleId) {
        setSlugError('This slug is already taken in this organization');
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error checking slug:', error);
      return true;
    } finally {
      setIsCheckingSlug(false);
    }
  }, []);

  // Handle title change with auto slug generation
  const handleTitleChange = async (value: string) => {
    setFormState((prev) => ({ ...prev, title: value }));
    
    // Auto-generate slug if user hasn't manually edited it
    if (!formState.slug || formState.slug === generateBaseSlug(formState.title)) {
      const baseSlug = generateBaseSlug(value);
      if (baseSlug && value.length > 2) {
        setFormState((prev) => ({ ...prev, slug: baseSlug }));
        await checkSlugUnique(baseSlug, orgId, articleId);
      }
    }
  };

  // Handle manual slug change
  const handleSlugChange = async (value: string) => {
    const sanitized = value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    
    setFormState((prev) => ({ ...prev, slug: sanitized }));
    
    if (sanitized.length > 2) {
      await checkSlugUnique(sanitized, orgId, articleId);
    }
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const trimmed = tagInput.trim();
      if (trimmed && !tags.includes(trimmed)) {
        setTags([...tags, trimmed]);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  // Build category tree for display
  const buildCategoryTree = (categories: Category[], parentId: string | null = null, depth = 0): Category[] => {
    const result: Category[] = [];
    for (const cat of categories) {
      if (cat.parentId === parentId) {
        result.push({ ...cat, name: '  '.repeat(depth) + cat.name });
        result.push(...buildCategoryTree(categories, cat.id, depth + 1));
      }
    }
    return result;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (!formState.title.trim()) {
        throw new Error('Title is required');
      }
      if (!formState.slug.trim()) {
        throw new Error('Slug is required');
      }
      if (slugError) {
        throw new Error('Please fix the slug error before submitting');
      }
      if (!formState.content.trim()) {
        throw new Error('Content is required');
      }

      const payload = {
        title: formState.title.trim(),
        slug: formState.slug.trim(),
        content: formState.content.trim(),
        contentType: formState.contentType,
        excerpt: formState.excerpt.trim() || null,
        categoryId: formState.categoryId || null,
        status: formState.status,
        visibility: formState.visibility,
        tags,
      };

      const response = await fetch(`/api/kb/articles/${articleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update article');
      }

      showToast('Article updated successfully', 'success');
      router.push('/app/kb');
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const categoryTree = buildCategoryTree(categories);

  // HTML Preview component
  const HtmlPreview = ({ html }: { html: string }) => {
    return (
      <div 
        className="prose prose-sm max-w-none border rounded-md p-4 bg-white min-h-[300px]"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/app/kb">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to KB
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Edit Article</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Organization (read-only) */}
            <div className="space-y-2">
              <Label>Organization</Label>
              <div className="p-2 border rounded-md bg-gray-50 text-gray-600">
                {organizations.find(o => o.id === orgId)?.name || 'Loading...'}
              </div>
            </div>

            {/* Category Selection */}
            <div className="space-y-2">
              <Label htmlFor="category">Category / Folder</Label>
              <Select 
                value={formState.categoryId} 
                onValueChange={(value) => setFormState((prev) => ({ ...prev, categoryId: value }))}
                disabled={isLoadingCategories}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <div className="flex items-center gap-2">
                      <Folder className="h-4 w-4 text-gray-400" />
                      <span>Uncategorized</span>
                    </div>
                  </SelectItem>
                  {categoryTree.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <div className="flex items-center gap-2">
                        <Folder className="h-4 w-4 text-blue-400" />
                        <span>{cat.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
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

            {/* Slug with uniqueness check */}
            <div className="space-y-2">
              <Label htmlFor="slug">Slug *</Label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Input
                    id="slug"
                    value={formState.slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    placeholder="article-url-slug"
                    required
                    className={slugError ? 'border-red-500' : ''}
                  />
                  {isCheckingSlug && (
                    <RefreshCw className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />
                  )}
                </div>
              </div>
              {slugError && (
                <p className="text-sm text-red-600">{slugError}</p>
              )}
              <p className="text-xs text-gray-500">
                This will be the URL: /kb/{formState.slug || 'your-article'}
              </p>
            </div>

            {/* Status, Visibility, and Content Type */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formState.status}
                  onValueChange={(value) => setFormState((prev) => ({ ...prev, status: value }))}
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

              <div className="space-y-2">
                <Label htmlFor="visibility">Visibility</Label>
                <Select
                  value={formState.visibility}
                  onValueChange={(value) => setFormState((prev) => ({ ...prev, visibility: value }))}
                >
                  <SelectTrigger id="visibility">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="internal">Internal</SelectItem>
                    <SelectItem value="agents_only">Agents Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contentType">Content Type</Label>
                <Select
                  value={formState.contentType}
                  onValueChange={(value: 'markdown' | 'html') => setFormState((prev) => ({ ...prev, contentType: value }))}
                >
                  <SelectTrigger id="contentType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="markdown">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Markdown
                      </div>
                    </SelectItem>
                    <SelectItem value="html">
                      <div className="flex items-center gap-2">
                        <Code className="h-4 w-4" />
                        HTML
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Excerpt */}
            <div className="space-y-2">
              <Label htmlFor="excerpt">Excerpt / Summary</Label>
              <Textarea
                id="excerpt"
                value={formState.excerpt}
                onChange={(e) => setFormState((prev) => ({ ...prev, excerpt: e.target.value }))}
                placeholder="Brief summary of the article (shown in search results)"
                rows={2}
              />
            </div>

            {/* Content with Preview */}
            <div className="space-y-2">
              <Label htmlFor="content">Content *</Label>
              {formState.contentType === 'html' ? (
                <Tabs defaultValue="edit" className="w-full">
                  <TabsList className="mb-2">
                    <TabsTrigger value="edit">
                      <Code className="h-4 w-4 mr-2" />
                      Edit HTML
                    </TabsTrigger>
                    <TabsTrigger value="preview">
                      <Eye className="h-4 w-4 mr-2" />
                      Preview
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="edit">
                    <Textarea
                      id="content"
                      value={formState.content}
                      onChange={(e) => setFormState((prev) => ({ ...prev, content: e.target.value }))}
                      placeholder="<h1>Your Article Title</h1>\n<p>Write your article content in HTML...</p>"
                      rows={15}
                      required
                      className="font-mono text-sm"
                    />
                  </TabsContent>
                  <TabsContent value="preview">
                    <HtmlPreview html={formState.content} />
                  </TabsContent>
                </Tabs>
              ) : (
                <Textarea
                  id="content"
                  value={formState.content}
                  onChange={(e) => setFormState((prev) => ({ ...prev, content: e.target.value }))}
                  placeholder="# Article Title\n\nWrite your article content in Markdown..."
                  rows={15}
                  required
                />
              )}
              <p className="text-xs text-gray-500">
                {formState.contentType === 'markdown' 
                  ? 'Supports Markdown formatting: # headers, **bold**, *italic*, [links](url), etc.'
                  : 'Write raw HTML. Be careful with tags to ensure proper rendering.'}
              </p>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-sm"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="text-gray-500 hover:text-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <Input
                id="tags"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder="Add tags (press Enter or comma to add)"
              />
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-2">
              <Button 
                type="submit" 
                disabled={isSubmitting || !!slugError}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
              <Link href="/app/kb">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
