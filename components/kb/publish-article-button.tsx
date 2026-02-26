 'use client';
 
 import { useState } from 'react';
 import { Button } from '@/components/ui/button';
 import { Loader2 } from 'lucide-react';
 import { useToast } from '@/components/ui/toast';
 
 export function PublishArticleButton({ articleId }: { articleId: string }) {
   const [loading, setLoading] = useState(false);
   const { success, error } = useToast();
 
   const onPublish = async () => {
     setLoading(true);
     try {
       const res = await fetch(`/api/kb/articles/${articleId}`, {
         method: 'PATCH',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           status: 'published',
           visibility: 'public',
           publishedAt: new Date().toISOString(),
         }),
       });
       if (!res.ok) {
         const data = await res.json().catch(() => ({ error: 'Failed to publish' }));
         throw new Error(data.error || 'Failed to publish');
       }
       success('Article published successfully');
       // Reload page to reflect changes
       window.location.reload();
     } catch (err) {
       error(err instanceof Error ? err.message : 'Failed to publish');
     } finally {
       setLoading(false);
     }
   };
 
   return (
     <Button onClick={onPublish} disabled={loading} className="bg-green-600 hover:bg-green-700">
       {loading ? (
         <>
           <Loader2 className="h-4 w-4 mr-2 animate-spin" />
           Publishing...
         </>
       ) : (
         <>Publish</>
       )}
     </Button>
   );
 }
