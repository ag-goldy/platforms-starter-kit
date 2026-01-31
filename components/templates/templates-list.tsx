'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { deleteTemplateAction } from '@/app/app/actions/templates';
import { useState } from 'react';
import { EditTemplateDialog } from './edit-template-dialog';
import type { TicketTemplate } from '@/db/schema';

interface TemplatesListProps {
  templates: (TicketTemplate & {
    createdBy: {
      id: string;
      name: string | null;
      email: string;
    } | null;
  })[];
}

export function TemplatesList({ templates }: TemplatesListProps) {
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleDelete = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) {
      return;
    }

    setIsDeleting(templateId);
    try {
      await deleteTemplateAction(templateId);
    } catch (error) {
      console.error('Failed to delete template:', error);
      alert('Failed to delete template');
    } finally {
      setIsDeleting(null);
    }
  };

  if (templates.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-gray-500">No templates yet. Create your first template to get started.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {templates.map((template) => (
        <Card key={template.id}>
          <CardHeader>
            <CardTitle className="text-base">{template.name}</CardTitle>
            <p className="text-xs text-gray-500">
              Created by {template.createdBy?.name || template.createdBy?.email || 'Unknown'}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs font-medium text-gray-700">Subject:</p>
              <p className="text-sm text-gray-600">{template.subject}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-700">Content:</p>
              <p className="text-sm text-gray-600 line-clamp-3">{template.content}</p>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingTemplate(template.id)}
                className="flex-1"
              >
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDelete(template.id)}
                disabled={isDeleting === template.id}
                className="flex-1 text-red-600 hover:text-red-700"
              >
                {isDeleting === template.id ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {editingTemplate && (
        <EditTemplateDialog
          templateId={editingTemplate}
          onClose={() => setEditingTemplate(null)}
        />
      )}
    </div>
  );
}

