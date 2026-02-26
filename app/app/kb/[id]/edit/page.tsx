 import { notFound } from 'next/navigation';
 import { requireInternalRole } from '@/lib/auth/permissions';
 import { db } from '@/db';
 import { kbArticles, kbCategories, organizations, users } from '@/db/schema';
 import { eq } from 'drizzle-orm';
 import Link from 'next/link';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { Badge } from '@/components/ui/badge';
 import { Button } from '@/components/ui/button';
 import { PublishArticleButton } from '@/components/kb/publish-article-button';
 import { formatDateTime } from '@/lib/utils/date';
 
 export default async function KBEditPage({
   params,
 }: {
   params: Promise<{ id: string }>;
 }) {
   await requireInternalRole();
   const { id } = await params;
 
   const article = await db.query.kbArticles.findFirst({
     where: eq(kbArticles.id, id),
   });
 
   if (!article) {
     notFound();
   }
 
   const category = article.categoryId
     ? await db.query.kbCategories.findFirst({ where: eq(kbCategories.id, article.categoryId) })
     : null;
 
   const org = article.orgId
     ? await db.query.organizations.findFirst({ where: eq(organizations.id, article.orgId) })
     : null;
 
   const author = await db.query.users.findFirst({ where: eq(users.id, article.authorId) });
 
   const statusColors: Record<string, string> = {
     draft: 'bg-gray-100 text-gray-800',
     published: 'bg-green-100 text-green-800',
     archived: 'bg-red-100 text-red-800',
   };
 
   const visibilityColors: Record<string, string> = {
     public: 'bg-blue-100 text-blue-800',
     internal: 'bg-yellow-100 text-yellow-800',
     agents_only: 'bg-purple-100 text-purple-800',
     org_only: 'bg-orange-100 text-orange-800',
   };
 
   return (
     <div className="space-y-6">
       <div className="flex items-center justify-between">
         <h1 className="text-2xl font-bold">Edit Article</h1>
         <div className="flex items-center gap-2">
           <Link href="/app/kb">
             <Button variant="outline">Back to KB</Button>
           </Link>
           <PublishArticleButton articleId={article.id} />
         </div>
       </div>
 
       <Card>
         <CardHeader>
           <CardTitle>{article.title}</CardTitle>
         </CardHeader>
         <CardContent className="space-y-3">
           <div className="flex items-center gap-2">
             <Badge className={statusColors[article.status] || 'bg-gray-100'}>{article.status}</Badge>
             <Badge className={visibilityColors[article.visibility] || 'bg-gray-100'}>
               {article.visibility}
             </Badge>
             <span className="text-sm text-gray-500">{org?.name || 'Global'}</span>
             {category && <span className="text-sm text-gray-500">Category: {category.name}</span>}
           </div>
           <div className="text-sm text-gray-500">
             <div>Created: {formatDateTime(article.createdAt)}</div>
             {article.updatedAt && <div>Updated: {formatDateTime(article.updatedAt)}</div>}
             {article.publishedAt && <div>Published: {formatDateTime(article.publishedAt)}</div>}
             {author && <div>Author: {author.name || author.email}</div>}
           </div>
           <div className="prose max-w-none">
             <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-3 rounded border">{article.content}</pre>
           </div>
         </CardContent>
       </Card>
     </div>
   );
 }
