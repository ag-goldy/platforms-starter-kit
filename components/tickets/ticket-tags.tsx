'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  assignTagToTicketAction,
  removeTagFromTicketAction,
  getAllTagsAction,
  getTicketTagsAction,
} from '@/app/app/actions/tags';
import { useRouter } from 'next/navigation';
import type { TicketTag } from '@/db/schema';

interface TicketTagsProps {
  ticketId: string;
}

export function TicketTags({ ticketId }: TicketTagsProps) {
  const router = useRouter();
  const [tags, setTags] = useState<TicketTag[]>([]);
  const [allTags, setAllTags] = useState<TicketTag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTagId, setSelectedTagId] = useState<string>('');

  useEffect(() => {
    async function loadTags() {
      try {
        const [ticketTags, allAvailableTags] = await Promise.all([
          getTicketTagsAction(ticketId),
          getAllTagsAction(),
        ]);
        setTags(Array.isArray(ticketTags) ? ticketTags as TicketTag[] : []);
        setAllTags(Array.isArray(allAvailableTags) ? allAvailableTags as TicketTag[] : []);
      } catch (error) {
        console.error('Failed to load tags:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadTags();
  }, [ticketId]);

  const handleAddTag = async () => {
    if (!selectedTagId) return;

    try {
      await assignTagToTicketAction(ticketId, selectedTagId);
      const updatedTags = await getTicketTagsAction(ticketId);
      setTags(Array.isArray(updatedTags) ? updatedTags as TicketTag[] : []);
      setSelectedTagId('');
      router.refresh();
    } catch (error) {
      console.error('Failed to add tag:', error);
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    try {
      await removeTagFromTicketAction(ticketId, tagId);
      const updatedTags = await getTicketTagsAction(ticketId);
      setTags(Array.isArray(updatedTags) ? updatedTags as TicketTag[] : []);
      router.refresh();
    } catch (error) {
      console.error('Failed to remove tag:', error);
    }
  };

  const availableTags = allTags.filter(
    (tag) => !tags.some((assignedTag) => assignedTag.id === tag.id)
  );

  if (isLoading) {
    return <div className="text-sm text-gray-500">Loading tags...</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {tags.length === 0 ? (
          <span className="text-sm text-gray-500">No tags assigned</span>
        ) : (
          tags.map((tag) => (
            <Badge
              key={tag.id}
              className="flex items-center gap-1"
              style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
            >
              {tag.name}
              <button
                onClick={() => handleRemoveTag(tag.id)}
                className="ml-1 hover:opacity-70"
                aria-label={`Remove ${tag.name} tag`}
              >
                ×
              </button>
            </Badge>
          ))
        )}
      </div>

      {availableTags.length > 0 && (
        <div className="flex gap-2">
          <Select value={selectedTagId} onValueChange={setSelectedTagId}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Add tag..." />
            </SelectTrigger>
            <SelectContent>
              {availableTags.map((tag) => (
                <SelectItem key={tag.id} value={tag.id}>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleAddTag} disabled={!selectedTagId} size="sm">
            Add
          </Button>
        </div>
      )}
    </div>
  );
}

