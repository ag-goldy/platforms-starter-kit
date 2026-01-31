'use client';
import { useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createServiceAction, deleteServiceAction, updateServiceAction } from '@/app/app/actions/services';
import { services } from '@/db/schema';
type Service = typeof services.$inferSelect;

export function ServiceManager({ orgId, initialServices }: { orgId: string; initialServices: Service[] }) {
  const [services, setServices] = useState(initialServices);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [isPending, startTransition] = useTransition();

  function resetForm() {
    setName('');
    setSlug('');
    setDescription('');
  }

  async function handleCreate() {
    startTransition(async () => {
      const result = await createServiceAction({
        orgId,
        name,
        slug,
        description,
      });
      if (result.service) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setServices((prev) => [...prev, result.service as any]);
        resetForm();
      }
    });
  }

  async function handleUpdate(service: Service, updates: Partial<Service>) {
    startTransition(async () => {
      await updateServiceAction(service.id, {
        name: updates.name,
        slug: updates.slug,
        description: updates.description,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        status: updates.status as any,
        isUnderContract: updates.isUnderContract,
      });
      setServices((prev) =>
        prev.map((s) => (s.id === service.id ? { ...s, ...updates } : s))
      );
    });
  }

  async function handleDelete(service: Service) {
    startTransition(async () => {
      await deleteServiceAction(service.id, orgId);
      setServices((prev) => prev.filter((s) => s.id !== service.id));
    });
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Create Service</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Input placeholder="Slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <Button onClick={handleCreate} disabled={isPending || !name || !slug}>Create</Button>
        </CardContent>
      </Card>

      <Card className="md:col-span-1">
        <CardHeader>
          <CardTitle>Existing Services</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {services.length === 0 ? (
            <p className="text-sm text-gray-600">No services yet.</p>
          ) : (
            services.map((service) => (
              <div key={service.id} className="rounded-md border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <Input
                    value={service.name}
                    onChange={(e) => handleUpdate(service, { name: e.target.value })}
                  />
                  <Select
                    value={service.status}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onValueChange={(v) => handleUpdate(service, { status: v as any })}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                      <SelectItem value="DEGRADED">DEGRADED</SelectItem>
                      <SelectItem value="OFFLINE">OFFLINE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  value={service.slug}
                  onChange={(e) => handleUpdate(service, { slug: e.target.value })}
                />
                <Input
                  value={service.description || ''}
                  onChange={(e) => handleUpdate(service, { description: e.target.value })}
                />
                <div className="flex gap-2">
                  <Button variant="destructive" onClick={() => handleDelete(service)}>Delete</Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
