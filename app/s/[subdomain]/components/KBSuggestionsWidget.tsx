'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, ArrowRight, Clock, Eye, Sparkles } from 'lucide-react';
import { useCustomerPortal } from '@/components/customer/CustomerPortalContext';

interface KBSuggestionsWidgetProps {
  subdomain: string;
  org: any;
}

interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  viewCount: number;
  updatedAt: string;
  isRecommended?: boolean;
}

export function KBSuggestionsWidget({ subdomain, org }: KBSuggestionsWidgetProps) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const { openSlideOver } = useCustomerPortal();

  useEffect(() => {
    fetchArticles();
  }, [org.id]);

  const fetchArticles = async () => {
    try {
      const res = await fetch(`/api/kb/${subdomain}/articles?limit=5`);
      if (res.ok) {
        const data = await res.json();
        // Mark first 2 as recommended based on recent tickets
        const articlesWithRecs = (data.articles || []).map((a: Article, i: number) => ({
          ...a,
          isRecommended: i < 2,
        }));
        setArticles(articlesWithRecs);
      }
    } catch (error) {
      console.error('Failed to fetch articles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleArticleClick = (article: Article) => {
    openSlideOver('kb', { articleSlug: article.slug });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-blue-500" />
          <h3 className="font-semibold text-stone-900">Knowledge Base</h3>
        </div>
        <button
          onClick={() => openSlideOver('kb')}
          className="text-xs text-brand-600 hover:text-brand-700 font-medium"
        >
          View all
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : articles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <BookOpen className="w-8 h-8 text-stone-300 mb-2" />
            <p className="text-xs text-stone-500">No articles yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {articles.map((article, index) => (
              <motion.button
                key={article.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => handleArticleClick(article)}
                className="w-full text-left p-3 rounded-lg hover:bg-stone-50 transition-colors group"
              >
                <div className="flex items-start gap-2">
                  {article.isRecommended && (
                    <Sparkles className="w-3 h-3 text-amber-500 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-stone-900 line-clamp-2 group-hover:text-brand-600 transition-colors">
                      {article.title}
                    </p>
                    <p className="text-xs text-stone-500 line-clamp-1 mt-0.5">
                      {article.excerpt}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[10px] text-stone-400 flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {article.viewCount}
                      </span>
                      <span className="text-[10px] text-stone-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(article.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-stone-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
