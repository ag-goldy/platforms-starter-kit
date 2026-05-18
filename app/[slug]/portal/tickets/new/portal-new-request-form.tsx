'use client';

import { useActionState, useMemo, useState } from 'react';
import { AlertCircle, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createPortalTicketAction } from '../../actions';

type RequestTypeOption = {
  id: string;
  name: string;
  description: string | null;
  formSchema?: {
    fields: Array<{
      id: string;
      label: string;
      type: string;
      required?: boolean;
      placeholder?: string;
      helperText?: string;
      options?: Array<{ label: string; value: string }>;
    }>;
  } | null;
};

type AssetOption = {
  id: string;
  name: string;
  hostname: string | null;
  serialNumber: string | null;
};

export function PortalNewRequestForm({
  slug,
  requestTypes,
  assets,
  defaultAssetId,
}: {
  slug: string;
  requestTypes: RequestTypeOption[];
  assets: AssetOption[];
  defaultAssetId?: string;
}) {
  const [state, action, pending] = useActionState(createPortalTicketAction, { error: null });
  const [selectedTypeId, setSelectedTypeId] = useState('');
  const selectedType = useMemo(
    () => requestTypes.find((type) => type.id === selectedTypeId) || null,
    [requestTypes, selectedTypeId]
  );

  return (
    <form action={action} className="space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <input type="hidden" name="slug" value={slug} />

      {state.error && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4" />
          <span>{state.error}</span>
        </div>
      )}

      {requestTypes.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="requestTypeId">Service catalog</Label>
          <select
            id="requestTypeId"
            name="requestTypeId"
            value={selectedTypeId}
            onChange={(event) => setSelectedTypeId(event.target.value)}
            className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm"
          >
            <option value="">Other request</option>
            {requestTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
          {selectedType?.description && (
            <p className="text-sm text-gray-500">{selectedType.description}</p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="subject">Subject</Label>
        <Input id="subject" name="subject" maxLength={200} required autoFocus />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={7} required />
      </div>

      {selectedType?.formSchema?.fields?.map((field) => (
        <div key={field.id} className="space-y-2">
          <Label htmlFor={field.id}>
            {field.label}
            {field.required ? <span className="text-orange-600"> *</span> : null}
          </Label>
          {field.type === 'textarea' ? (
            <Textarea id={field.id} name={field.id} required={field.required} placeholder={field.placeholder} />
          ) : field.type === 'select' ? (
            <select
              id={field.id}
              name={field.id}
              required={field.required}
              className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm"
            >
              <option value="">Select</option>
              {field.options?.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : field.type === 'checkbox' ? (
            <input id={field.id} name={field.id} type="checkbox" className="h-4 w-4 rounded border-gray-300" />
          ) : field.type === 'fileHint' ? (
            <p className="rounded-md bg-gray-50 p-3 text-sm text-gray-600">{field.helperText || field.label}</p>
          ) : (
            <Input
              id={field.id}
              name={field.id}
              type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
              required={field.required}
              placeholder={field.placeholder}
            />
          )}
          {field.helperText && field.type !== 'fileHint' && (
            <p className="text-xs text-gray-500">{field.helperText}</p>
          )}
        </div>
      ))}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="assetId">Related asset</Label>
          <select
            id="assetId"
            name="assetId"
            defaultValue={defaultAssetId}
            className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm"
          >
            <option value="">No asset</option>
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.name}{asset.hostname ? ` (${asset.hostname})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="priority">Priority</Label>
          <select
            id="priority"
            name="priority"
            defaultValue="P3"
            className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm"
          >
            <option value="P4">Low</option>
            <option value="P3">Medium</option>
            <option value="P2">High</option>
          </select>
          <p className="text-xs text-gray-500">Critical priority is reserved for agents.</p>
        </div>
      </div>

      <Button type="submit" disabled={pending} className="w-full bg-black text-white hover:bg-gray-900 sm:w-auto">
        <Send className="mr-2 h-4 w-4 text-orange-500" />
        {pending ? 'Submitting...' : 'Submit request'}
      </Button>
    </form>
  );
}
