import { requireInternalRole } from '@/lib/auth/permissions';
import { db } from '@/db';
import { kbArticles, kbCategories, users, organizations } from '@/db/schema';
import { desc, eq, asc } from 'drizzle-orm';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Plus, Edit, Eye, ThumbsUp, Calendar, FolderTree } from 'lucide-react';
import { formatDateTime } from '@/lib/utils/date';

export default async function KBAdminPage() {
  await requireInternalRole();

  // Get all articles with relations (including global articles with null orgId)
  const articles = await db
    .select({
      article: kbArticles,
      category: kbCategories,
      author: users,
      org: organizations,
    })
    .from(kbArticles)
    .leftJoin(kbCategories, eq(kbArticles.categoryId, kbCategories.id))
    .leftJoin(users, eq(kbArticles.authorId, users.id))
    .leftJoin(organizations, eq(kbArticles.orgId, organizations.id))
    .orderBy(desc(kbArticles.createdAt));

  // Get all categories (including global categories with null orgId)
  const categories = await db
    .select({
      category: kbCategories,
      org: organizations,
    })
    .from(kbCategories)
    .leftJoin(organizations, eq(kbCategories.orgId, organizations.id))
    .orderBy(asc(kbCategories.name));

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800',
    published: 'bg-green-100 text-green-800',
    archived: 'bg-red-100 text-red-800',
  };

  const visibilityColors: Record<string, string> = {
    public: 'bg-blue-100 text-blue-800',
    internal: 'bg-yellow-100 text-yellow-800',
    agents_only: 'bg-purple-100 text-purple-800',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            Knowledge Base
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage knowledge base articles and categories across all organizations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/app/kb/categories">
            <Button variant="outline">
              <FolderTree className="h-4 w-4 mr-2" />
              Categories
            </Button>
          </Link>
          <Link href="/app/kb/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Article
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{articles.length}</div>
            <p className="text-sm text-gray-600">Total Articles</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {articles.filter(a => a.article.status === 'published').length}
            </div>
            <p className="text-sm text-gray-600">Published</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {articles.filter(a => a.article.status === 'draft').length}
            </div>
            <p className="text-sm text-gray-600">Drafts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{categories.length}</div>
            <p className="text-sm text-gray-600">Categories</p>
          </CardContent>
        </Card>
      </div>

      {/* Categories */}
      <Card>
        <CardHeader>
          <CardTitle>Categories</CardTitle>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <p className="text-sm text-gray-500">No categories found</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {categories.map(({ category, org }) => (
                <Link
                  key={category.id}
                  href={`/app/kb/category/${category.slug}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors text-sm"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  {category.name}
                  <span className="text-gray-500">({org?.name || 'Global'})</span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Articles */}
      <Card>
        <CardHeader>
          <CardTitle>Articles</CardTitle>
        </CardHeader>
        <CardContent>
          {articles.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No articles yet</p>
              <Link href="/app/kb/new">
                <Button variant="outline" className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Article
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {articles.map(({ article, category, author, org }) => (
                <div
                  key={article.id}
                  className="flex items-start justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium truncate">{article.title}</h3>
                      <Badge className={statusColors[article.status] || 'bg-gray-100'}>
                        {article.status}
                      </Badge>
                      <Badge className={visibilityColors[article.visibility] || 'bg-gray-100'}>
                        {article.visibility}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                      {article.excerpt || article.content.substring(0, 150)}...
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-3 w-3" />
                        {category?.name || 'Uncategorized'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDateTime(article.createdAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {article.viewCount} views
                      </span>
                      <span className="flex items-center gap-1">
                        <ThumbsUp className="h-3 w-3" />
                        {article.helpfulCount} helpful
                      </span>
                      <span className="text-gray-400">• {org?.name || 'Global'}</span>
                      {author && (
                        <span className="text-gray-400">by {author.name || author.email}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Link
                      href={`/app/kb/category/${category?.slug}/${article.slug}`}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      View
                    </Link>
                    <Link
                      href={`/app/kb/${article.id}/edit`}
                      className="text-sm text-gray-600 hover:text-gray-900"
                    >
                      <Edit className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
