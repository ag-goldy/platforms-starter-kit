'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

interface OrganizationFormProps {
  action: (formData: FormData) => Promise<void>;
  initialData?: {
    name?: string;
    slug?: string;
    subdomain?: string;
  };
}

export function OrganizationForm({ action, initialData }: OrganizationFormProps) {
  const [name, setName] = useState(initialData?.name || '');
  const [slug, setSlug] = useState(initialData?.slug || '');
  const [subdomain, setSubdomain] = useState(initialData?.subdomain || '');

  // Auto-generate slug from name
  const handleNameChange = (value: string) => {
    setName(value);
    if (!slug) {
      const autoSlug = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      setSlug(autoSlug);
      setSubdomain(autoSlug);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Organization Name</Label>
            <Input
              id="name"
              name="name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Acme Corporation"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              name="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="acme"
              required
              pattern="[a-z0-9-]+"
            />
            <p className="text-xs text-gray-500">
              Lowercase letters, numbers, and hyphens only
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subdomain">Subdomain</Label>
            <Input
              id="subdomain"
              name="subdomain"
              value={subdomain}
              onChange={(e) => setSubdomain(e.target.value)}
              placeholder="acme"
              required
              pattern="[a-z0-9-]+"
            />
            <p className="text-xs text-gray-500">
              Customer portal will be accessible at: {subdomain || 'subdomain'}.{process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000'}
            </p>
          </div>

          <div className="flex gap-3">
            <Button type="submit">Create Organization</Button>
            <Link href="/app/organizations">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

