'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { deleteTagAction } from '@/app/app/actions/tags';
import { useState } from 'react';
import { EditTagDialog } from './edit-tag-dialog';
import type { TicketTag } from '@/db/schema';

interface TagsListProps {
  tags: TicketTag[];
}

export function TagsList({ tags }: TagsListProps) {
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleDelete = async (tagId: string) => {
    if (!confirm('Are you sure you want to delete this tag? It will be removed from all tickets.')) {
      return;
    }

    setIsDeleting(tagId);
    try {
      await deleteTagAction(tagId);
      window.location.reload();
    } catch (error) {
      console.error('Failed to delete tag:', error);
      alert('Failed to delete tag');
    } finally {
      setIsDeleting(null);
    }
  };

  if (tags.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-gray-500">No tags yet. Create your first tag to get started.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {tags.map((tag) => (
        <Card key={tag.id}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="h-4 w-4 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                <span className="font-medium">{tag.name}</span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingTag(tag.id)}
                >
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(tag.id)}
                  disabled={isDeleting === tag.id}
                  className="text-red-600 hover:text-red-700"
                >
                  {isDeleting === tag.id ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {editingTag && (
        <EditTagDialog
          tagId={editingTag}
          onClose={() => setEditingTag(null)}
        />
      )}
    </div>
  );
}

