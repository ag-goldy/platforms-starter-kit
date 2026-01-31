'use client';

import { useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getCannedResponsesAction } from '@/app/app/actions/canned-responses';
import type { cannedResponses } from '@/db/schema';

type CannedResponse = typeof cannedResponses.$inferSelect;

interface CannedResponsePickerProps {
  orgId: string;
  onSelect: (content: string) => void;
  className?: string;
}

export function CannedResponsePicker({
  orgId,
  onSelect,
  className,
}: CannedResponsePickerProps) {
  const [responses, setResponses] = useState<CannedResponse[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');

  useEffect(() => {
    async function loadResponses() {
      try {
        const data = await getCannedResponsesAction(orgId);
        setResponses(data);
      } catch (error) {
        console.error('Failed to load canned responses:', error);
      }
    }
    if (orgId) {
      loadResponses();
    }
  }, [orgId]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    const response = responses.find((r) => r.id === id);
    if (response) {
      onSelect(response.content);
      // Reset selection after a brief delay
      setTimeout(() => setSelectedId(''), 100);
    }
  };

  if (responses.length === 0) {
    return null;
  }

  return (
    <Select value={selectedId} onValueChange={handleSelect}>
      <SelectTrigger className={className}>
        <SelectValue placeholder="Use canned response..." />
      </SelectTrigger>
      <SelectContent>
        {responses.map((response) => (
          <SelectItem key={response.id} value={response.id}>
            {response.name}
            {response.shortcut && (
              <span className="text-xs text-gray-500 ml-2">({response.shortcut})</span>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

