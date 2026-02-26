'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardDescription } from '@/components/ui/card';
import { submitCustomerKBArticleAction } from '@/app/s/[subdomain]/actions/kb';
import type { KbCategory } from '@/db/schema';

interface KBArticleSubmitFormProps {
  orgId: string;
  subdomain: string;
  categories: KbCategory[];
  userName: string | null;
}

export function KBArticleSubmitForm({
  orgId,
  subdomain,
  categories,
  userName,
}: KBArticleSubmitFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    categoryId: '',
    visibility: 'org_only' as 'public' | 'org_only',
    isAnonymous: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await submitCustomerKBArticleAction(orgId, {
        title: formData.title,
        content: formData.content,
        categoryId: formData.categoryId || null,
        visibility: formData.visibility,
        isAnonymous: formData.isAnonymous,
        tags: [],
      });

      setSuccess(true);
      setTimeout(() => {
        router.push(`/s/${subdomain}/kb`);
        router.refresh();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit article');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <Card className="bg-green-50 border-green-200 p-4">
        <CardDescription className="text-green-800">
          Article submitted successfully! It will be reviewed before publication.
          Redirecting...
        </CardDescription>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Card className="bg-red-50 border-red-200 p-4">
          <CardDescription className="text-red-800">{error}</CardDescription>
        </Card>
      )}

      <div className="space-y-2">
        <Label htmlFor="title">Article Title</Label>
        <Input
          id="title"
          placeholder="Enter a clear, descriptive title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          required
          maxLength={200}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">Category (Optional)</Label>
        <Select
          value={formData.categoryId}
          onValueChange={(value) => setFormData({ ...formData, categoryId: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Uncategorized</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="content">Content</Label>
        <Textarea
          id="content"
          placeholder="Write your article content here... You can use Markdown formatting."
          value={formData.content}
          onChange={(e) => setFormData({ ...formData, content: e.target.value })}
          required
          rows={12}
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Supports Markdown formatting. Minimum 10 characters.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Visibility</Label>
        <Select
          value={formData.visibility}
          onValueChange={(value: 'public' | 'org_only') =>
            setFormData({ ...formData, visibility: value })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="org_only">
              Organization Only - Visible to your organization members
            </SelectItem>
            <SelectItem value="public">
              Public - Visible to anyone (if approved)
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {formData.visibility === 'public' && (
        <div className="flex items-start space-x-3 p-4 bg-muted rounded-lg">
          <Checkbox
            id="anonymous"
            checked={formData.isAnonymous}
            onCheckedChange={(checked) =>
              setFormData({ ...formData, isAnonymous: checked as boolean })
            }
          />
          <div className="space-y-1">
            <Label htmlFor="anonymous" className="font-medium cursor-pointer">
              Post Anonymously
            </Label>
            <p className="text-sm text-muted-foreground">
              Hide my name from public view. Your identity will still be visible to administrators.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-4">
        <div className="text-sm text-muted-foreground">
          Submitting as: {formData.isAnonymous ? 'Anonymous' : userName}
        </div>
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/s/${subdomain}/kb`)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit for Review'}
          </Button>
        </div>
      </div>
    </form>
  );
}
