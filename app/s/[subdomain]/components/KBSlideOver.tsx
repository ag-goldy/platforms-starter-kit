'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  Search,
  Clock,
  Eye,
  ThumbsUp,
  ArrowRight,
  FileText,
  ChevronLeft,
  Plus,
  Edit,
  Trash2,
  X,
  Save,
  MoreHorizontal,
  Folder,
  Tag,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface KBSlideOverProps {
  data: {
    articleSlug?: string;
    mode?: 'view' | 'create' | 'edit';
  } | null;
  onClose: () => void;
}

interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  categoryId?: string;
  viewCount: number;
  helpfulCount: number;
  createdAt: string;
  updatedAt: string;
  status: 'published' | 'draft' | 'pending_review';
}

interface Category {
  id: string;
  name: string;
  slug: string;
  articleCount: number;
}

export function KBSlideOver({ data, onClose }: KBSlideOverProps) {
  const params = useParams();
  const subdomain = params?.subdomain as string;
  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [mode, setMode] = useState<'list' | 'view' | 'create' | 'edit'>('list');
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state for create/edit
  const [formData, setFormData] = useState({
    title: '',
    excerpt: '',
    content: '',
    categoryId: '',
    status: 'published' as const,
  });

  useEffect(() => {
    fetchUserRole();
    fetchArticles();
  }, [subdomain]);

  useEffect(() => {
    if (data?.articleSlug) {
      fetchArticle(data.articleSlug);
    } else if (data?.mode === 'create') {
      setMode('create');
      setFormData({
        title: '',
        excerpt: '',
        content: '',
        categoryId: categories[0]?.id || '',
        status: 'published',
      });
    } else {
      setMode('list');
    }
  }, [data, categories]);

  const fetchUserRole = async () => {
    try {
      const res = await fetch(`/api/user/membership/org-from-subdomain/${subdomain}`);
      if (res.ok) {
        const data = await res.json();
        setUserRole(data.role);
      }
    } catch (error) {
      console.error('Failed to fetch user role:', error);
    }
  };

  const fetchArticles = async () => {
    try {
      const res = await fetch(`/api/kb/${subdomain}/articles?limit=50`);
      if (res.ok) {
        const data = await res.json();
        setArticles(data.articles || []);
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('Failed to fetch articles:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchArticle = async (slug: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/kb/${subdomain}/articles/${slug}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedArticle(data);
        setMode('view');
      }
    } catch (error) {
      console.error('Failed to fetch article:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateArticle = async () => {
    if (!formData.title.trim() || !formData.content.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/kb/${subdomain}/articles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        const newArticle = await res.json();
        setArticles((prev) => [newArticle, ...prev]);
        setMode('list');
        setFormData({ title: '', excerpt: '', content: '', categoryId: '', status: 'published' });
      }
    } catch (error) {
      console.error('Failed to create article:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateArticle = async () => {
    if (!selectedArticle || !formData.title.trim() || !formData.content.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/kb/${subdomain}/articles/${selectedArticle.slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        const updated = await res.json();
        setArticles((prev) =>
          prev.map((a) => (a.id === updated.id ? updated : a))
        );
        setSelectedArticle(updated);
        setMode('view');
      }
    } catch (error) {
      console.error('Failed to update article:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteArticle = async (article: Article) => {
    if (!confirm('Are you sure you want to delete this article?')) return;

    try {
      const res = await fetch(`/api/kb/${subdomain}/articles/${article.slug}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setArticles((prev) => prev.filter((a) => a.id !== article.id));
        if (selectedArticle?.id === article.id) {
          setSelectedArticle(null);
          setMode('list');
        }
      }
    } catch (error) {
      console.error('Failed to delete article:', error);
    }
  };

  const handleEditClick = () => {
    if (!selectedArticle) return;
    setFormData({
      title: selectedArticle.title,
      excerpt: selectedArticle.excerpt,
      content: selectedArticle.content,
      categoryId: selectedArticle.categoryId || categories[0]?.id || '',
      status: selectedArticle.status,
    });
    setMode('edit');
  };

  const canManageArticles = userRole === 'CUSTOMER_ADMIN' || userRole === 'ADMIN';

  const filteredArticles = articles.filter(
    (article) =>
      (selectedCategory === null || article.category === selectedCategory) &&
      (article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.content.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Create/Edit Form
  if (mode === 'create' || mode === 'edit') {
    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-stone-900">
              {mode === 'create' ? 'Create Article' : 'Edit Article'}
            </h2>
            <p className="text-sm text-stone-500">
              {mode === 'create' ? 'Add a new knowledge base article' : 'Update article content'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => mode === 'edit' && selectedArticle ? setMode('view') : setMode('list')}
              className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={mode === 'create' ? handleCreateArticle : handleUpdateArticle}
              disabled={isSubmitting || !formData.title.trim() || !formData.content.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-brand-500 text-white rounded-lg font-medium hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="w-4 h-4" />
              {isSubmitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-700">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Article title"
              className="w-full px-4 py-2 rounded-lg border border-stone-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-700">Category</label>
              <select
                value={formData.categoryId}
                onChange={(e) => setFormData((prev) => ({ ...prev, categoryId: e.target.value }))}
                className="w-full px-4 py-2 rounded-lg border border-stone-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-700">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as any }))}
                className="w-full px-4 py-2 rounded-lg border border-stone-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
              >
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="pending_review">Pending Review</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-700">Excerpt</label>
            <textarea
              value={formData.excerpt}
              onChange={(e) => setFormData((prev) => ({ ...prev, excerpt: e.target.value }))}
              placeholder="Brief summary of the article"
              rows={2}
              className="w-full px-4 py-2 rounded-lg border border-stone-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all resize-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-700">Content (Markdown)</label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData((prev) => ({ ...prev, content: e.target.value }))}
              placeholder="Write your article content in Markdown..."
              rows={15}
              className="w-full px-4 py-3 rounded-lg border border-stone-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all resize-none font-mono text-sm"
            />
          </div>
        </div>
      </div>
    );
  }

  // Article Detail View
  if (mode === 'view' && selectedArticle) {
    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-100">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setMode('list')}
              className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-900 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to articles
            </button>
            {canManageArticles && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleEditClick}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteArticle(selectedArticle)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            )}
          </div>
          <span className="inline-block px-2 py-0.5 bg-brand-100 text-brand-700 text-xs font-medium rounded-full mb-2">
            {selectedArticle.category}
          </span>
          <h2 className="text-xl font-semibold text-stone-900">{selectedArticle.title}</h2>
          <div className="flex items-center gap-4 mt-2 text-sm text-stone-500">
            <span className="flex items-center gap-1">
              <Eye className="w-4 h-4" />
              {selectedArticle.viewCount} views
            </span>
            <span className="flex items-center gap-1">
              <ThumbsUp className="w-4 h-4" />
              {selectedArticle.helpfulCount} helpful
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              Updated {new Date(selectedArticle.updatedAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-6">
            <article className="prose prose-stone max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {selectedArticle.content}
              </ReactMarkdown>
            </article>
          </div>

          {/* Related Articles */}
          <div className="px-6 py-4 border-t border-stone-100 bg-stone-50/50">
            <h3 className="text-sm font-semibold text-stone-900 mb-3">Related Articles</h3>
            <div className="space-y-2">
              {articles
                .filter(
                  (a) =>
                    a.category === selectedArticle.category && a.id !== selectedArticle.id
                )
                .slice(0, 3)
                .map((article) => (
                  <button
                    key={article.id}
                    onClick={() => fetchArticle(article.slug)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg bg-white border border-stone-200 hover:border-brand-300 transition-colors text-left"
                  >
                    <FileText className="w-4 h-4 text-stone-400" />
                    <span className="flex-1 text-sm font-medium text-stone-900 truncate">
                      {article.title}
                    </span>
                    <ArrowRight className="w-4 h-4 text-stone-400" />
                  </button>
                ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Article List View
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-stone-100">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-stone-900">Knowledge Base</h2>
            <p className="text-sm text-stone-500">{articles.length} articles</p>
          </div>
          {canManageArticles && (
            <button
              onClick={() => setMode('create')}
              className="flex items-center gap-2 px-4 py-2 bg-brand-500 text-white rounded-lg font-medium hover:bg-brand-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Article
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="px-6 py-3 border-b border-stone-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search articles..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-stone-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="w-4 h-4 text-stone-400 hover:text-stone-600" />
            </button>
          )}
        </div>
      </div>

      {/* Categories */}
      {categories.length > 0 && !searchQuery && (
        <div className="px-6 py-3 border-b border-stone-100">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                selectedCategory === null
                  ? 'bg-brand-500 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              All
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.name)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  selectedCategory === category.name
                    ? 'bg-brand-500 text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {category.name} ({category.articleCount})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Articles List */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <BookOpen className="w-12 h-12 text-stone-300 mb-3" />
            <p className="text-sm text-stone-500">
              {searchQuery ? 'No articles found' : 'No articles yet'}
            </p>
            {canManageArticles && !searchQuery && (
              <button
                onClick={() => setMode('create')}
                className="mt-3 text-sm text-brand-600 hover:text-brand-700 font-medium"
              >
                Create your first article
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredArticles.map((article, index) => (
              <motion.div
                key={article.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="group p-4 rounded-xl bg-white border border-stone-200 hover:border-brand-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    onClick={() => fetchArticle(article.slug)}
                    className="flex-1 text-left"
                  >
                    <span className="inline-block px-2 py-0.5 bg-brand-50 text-brand-700 text-xs font-medium rounded-full mb-2">
                      {article.category}
                    </span>
                    <h3 className="font-medium text-stone-900 mb-1 group-hover:text-brand-600 transition-colors">
                      {article.title}
                    </h3>
                    <p className="text-sm text-stone-500 line-clamp-2">{article.excerpt}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-stone-400">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {article.viewCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(article.updatedAt).toLocaleDateString()}
                      </span>
                      {article.status !== 'published' && (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          article.status === 'draft' ? 'bg-stone-100 text-stone-600' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {article.status.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                  </button>
                  {canManageArticles && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedArticle(article);
                          setFormData({
                            title: article.title,
                            excerpt: article.excerpt,
                            content: article.content,
                            categoryId: article.categoryId || categories[0]?.id || '',
                            status: article.status,
                          });
                          setMode('edit');
                        }}
                        className="p-2 text-stone-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteArticle(article);
                        }}
                        className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
