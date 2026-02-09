'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, FileText, Eye, ThumbsUp, Calendar, FolderOpen, Loader2 } from 'lucide-react';
import type { KbArticle, KbCategory } from '@/db/schema';

interface ArticleWithRelations extends KbArticle {
  category: KbCategory | null;
  author: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

interface ArticleListProps {
  subdomain: string;
  initialArticles?: ArticleWithRelations[];
  categories?: KbCategory[];
  showSearch?: boolean;
  showFilters?: boolean;
  categorySlug?: string;
  emptyMessage?: string;
}

export function ArticleList({
  subdomain,
  initialArticles = [],
  categories = [],
  showSearch = true,
  showFilters = true,
  categorySlug,
  emptyMessage = 'No articles found',
}: ArticleListProps) {
  const router = useRouter();
  const [articles, setArticles] = useState<ArticleWithRelations[]>(initialArticles);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(categorySlug || 'all');
  const [sortBy, setSortBy] = useState<string>('createdAt');

  const fetchArticles = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('org', subdomain);
      params.set('status', 'published');
      params.set('visibility', 'public');
      
      if (searchQuery) {
        params.set('search', searchQuery);
      }
      
      if (selectedCategory && selectedCategory !== 'all') {
        params.set('category', selectedCategory);
      }
      
      params.set('sortBy', sortBy);

      const response = await fetch(`/api/kb/articles?${params.toString()}`);
      const data = await response.json();
      
      if (response.ok) {
        setArticles(data.articles || []);
      }
    } catch (error) {
      console.error('Failed to fetch articles:', error);
    } finally {
      setIsLoading(false);
    }
  }, [subdomain, searchQuery, selectedCategory, sortBy]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (initialArticles.length === 0 || searchQuery || selectedCategory !== 'all') {
        fetchArticles();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedCategory, sortBy, fetchArticles, initialArticles.length]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">Published</Badge>;
      case 'draft':
        return <Badge variant="secondary">Draft</Badge>;
      case 'archived':
        return <Badge variant="outline">Archived</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'Not published';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      {(showSearch || showFilters) && (
        <div className="flex flex-col sm:flex-row gap-4">
          {showSearch && (
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search articles..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          )}
          
          {showFilters && categories.length > 0 && (
            <Select
              value={selectedCategory}
              onValueChange={setSelectedCategory}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.slug}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt">Newest First</SelectItem>
              <SelectItem value="viewCount">Most Viewed</SelectItem>
              <SelectItem value="title">Title (A-Z)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Articles Grid */}
      {!isLoading && articles.length === 0 && (
        <div className="text-center py-12 border rounded-lg bg-muted/50">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{emptyMessage}</p>
        </div>
      )}

      {!isLoading && articles.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <Link
              key={article.id}
              href={`/s/${subdomain}/kb/${article.slug}`}
              className="block"
            >
              <Card className="h-full hover:border-primary transition-colors cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base font-semibold line-clamp-2">
                      {article.title}
                    </CardTitle>
                    {getStatusBadge(article.status)}
                  </div>
                  {article.category && (
                    <CardDescription className="flex items-center gap-1">
                      <FolderOpen className="h-3 w-3" />
                      {article.category.name}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="pt-0">
                  {article.excerpt && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                      {article.excerpt}
                    </p>
                  )}
                  
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {article.viewCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <ThumbsUp className="h-3 w-3" />
                        {article.helpfulCount}
                      </span>
                    </div>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(article.publishedAt || article.createdAt)}
                    </span>
                  </div>
                  
                  {article.tags && article.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {article.tags.slice(0, 3).map((tag, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {article.tags.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{article.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
