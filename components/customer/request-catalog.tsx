'use client';

import { useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormError } from '@/components/ui/form-error';
import { useToast } from '@/components/ui/toast';
import type { Area, Asset, RequestType, Site } from '@/db/schema';
import { RequestFormFields } from '@/components/request-types/request-form-fields';
import { createCustomerTicketWithAttachmentsAction } from '@/app/s/[subdomain]/actions/tickets';
import { useRouter } from 'next/navigation';
import { formatErrorMessage } from '@/lib/utils/errors';
import { requestFormSchema } from '@/lib/request-types/validation';
import { type InferSelectModel } from 'drizzle-orm';
import { services } from '@/db/schema';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Service = InferSelectModel<typeof services>;

interface CustomerRequestCatalogProps {
  subdomain: string;
  requestTypes: RequestType[];
  sites: Site[];
  areas: Area[];
  assets: Asset[];
  services?: Service[];
  defaultServiceId?: string;
  isAdmin: boolean;
  criticalNotice?: { title: string; body: string } | null;
}

export function CustomerRequestCatalog({
  subdomain,
  requestTypes,
  sites,
  areas,
  assets,
  services = [],
  defaultServiceId,
  isAdmin,
  criticalNotice,
}: CustomerRequestCatalogProps) {
  const { showToast } = useToast();
  const router = useRouter();
  const [selectedRequestTypeId, setSelectedRequestTypeId] = useState<string | null>(
    requestTypes[0]?.id || null
  );
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [siteId, setSiteId] = useState('');
  const [areaId, setAreaId] = useState('');
  const [serviceId, setServiceId] = useState(defaultServiceId || '');
  const [assetSearch, setAssetSearch] = useState('');
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [siteSearch, setSiteSearch] = useState('');
  const [areaSearch, setAreaSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedRequestType = requestTypes.find((type) => type.id === selectedRequestTypeId) || null;
  const schema = useMemo(() => {
    if (!selectedRequestType?.formSchema) {
      return requestFormSchema.parse({ fields: [] });
    }
    const parsed = requestFormSchema.safeParse(selectedRequestType.formSchema);
    return parsed.success ? parsed.data : requestFormSchema.parse({ fields: [] });
  }, [selectedRequestType]);

  const filteredSites = useMemo(() => {
    const term = siteSearch.trim().toLowerCase();
    if (!term) return sites;
    return sites.filter((site) => site.name.toLowerCase().includes(term));
  }, [siteSearch, sites]);

  const filteredAreas = useMemo(() => {
    const scopedAreas = siteId ? areas.filter((area) => area.siteId === siteId) : areas;
    const term = areaSearch.trim().toLowerCase();
    if (!term) return scopedAreas;
    return scopedAreas.filter((area) => area.name.toLowerCase().includes(term));
  }, [areas, areaSearch, siteId]);

  const filteredAssets = useMemo(() => {
    const term = assetSearch.trim().toLowerCase();
    if (!term) return assets;
    return assets.filter((asset) =>
      [asset.name, asset.type, asset.hostname, asset.serialNumber]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(term))
    );
  }, [assetSearch, assets]);

  const handleRequestTypeSelect = (requestTypeId: string) => {
    setSelectedRequestTypeId(requestTypeId);
    setFormValues({});
    setError(null);
  };

  const handleAssetToggle = (assetId: string) => {
    setSelectedAssetIds((prev) =>
      prev.includes(assetId)
        ? prev.filter((id) => id !== assetId)
        : [...prev, assetId]
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedRequestType) {
      setError('Please select a request type.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('subdomain', subdomain);
      formData.append('requestTypeId', selectedRequestType.id);
      formData.append('requestPayload', JSON.stringify(formValues));

      if (serviceId && serviceId !== 'none') {
        formData.append('serviceId', serviceId);
      }
      if (siteId) {
        formData.append('siteId', siteId);
      }
      if (areaId) {
        formData.append('areaId', areaId);
      }
      selectedAssetIds.forEach((assetId) => {
        formData.append('assetIds', assetId);
      });

      const files = fileInputRef.current?.files;
      if (files && files.length > 0) {
        for (const file of Array.from(files)) {
          formData.append('attachments', file);
        }
      }

      const result = await createCustomerTicketWithAttachmentsAction(formData);
      if (result.error) {
        setError(result.error);
        showToast(result.error, 'error');
      } else {
        showToast('Request submitted successfully', 'success');
        router.push(`/s/${subdomain}/tickets/${result.ticketId}`);
      }
    } catch (submitError) {
      const message = formatErrorMessage(submitError);
      setError(message);
      showToast(message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {criticalNotice && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-red-700">{criticalNotice.title}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-red-700">
            {criticalNotice.body}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        {requestTypes.map((type) => (
          <button
            key={type.id}
            type="button"
            onClick={() => handleRequestTypeSelect(type.id)}
            className={`rounded-lg border p-4 text-left transition ${
              selectedRequestTypeId === type.id ? 'border-blue-500 bg-blue-50' : 'bg-white hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">{type.name}</h3>
              {!type.isActive && <Badge variant="secondary">Inactive</Badge>}
            </div>
            {type.description && (
              <p className="mt-1 text-xs text-gray-600 line-clamp-2">{type.description}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
              <Badge variant="outline">{type.category.replace('_', ' ')}</Badge>
              <Badge variant="outline">{type.defaultPriority}</Badge>
            </div>
          </button>
        ))}
      </div>

      {selectedRequestType && (
        <Card>
          <CardHeader>
            <CardTitle>{selectedRequestType.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <FormError error={error} />

              {services.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="service">Related Service (Optional)</Label>
                  <Select value={serviceId} onValueChange={setServiceId}>
                    <SelectTrigger id="service">
                      <SelectValue placeholder="Select a service..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {services.map((service) => (
                        <SelectItem key={service.id} value={service.id}>
                          {service.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <RequestFormFields schema={schema} values={formValues} onChange={setFormValues} />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="site-filter">Site (optional)</Label>
                  <Input
                    id="site-filter"
                    value={siteSearch}
                    onChange={(event) => setSiteSearch(event.target.value)}
                    placeholder="Search sites..."
                  />
                  <select
                    value={siteId}
                    onChange={(event) => {
                      setSiteId(event.target.value);
                      setAreaId('');
                    }}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">No site</option>
                    {filteredSites.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="area-filter">Area (optional)</Label>
                  <Input
                    id="area-filter"
                    value={areaSearch}
                    onChange={(event) => setAreaSearch(event.target.value)}
                    placeholder="Search areas..."
                  />
                  <select
                    value={areaId}
                    onChange={(event) => setAreaId(event.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">No area</option>
                    {filteredAreas.map((area) => (
                      <option key={area.id} value={area.id}>
                        {area.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {isAdmin && (
                <div className="space-y-2">
                  <Label htmlFor="asset-filter">Assets (optional)</Label>
                  <Input
                    id="asset-filter"
                    value={assetSearch}
                    onChange={(event) => setAssetSearch(event.target.value)}
                    placeholder="Search assets..."
                  />
                  <div className="max-h-48 overflow-y-auto rounded-md border p-3 space-y-2">
                    {filteredAssets.length === 0 && (
                      <p className="text-xs text-gray-500">No matching assets.</p>
                    )}
                    {filteredAssets.map((asset) => (
                      <label key={asset.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedAssetIds.includes(asset.id)}
                          onChange={() => handleAssetToggle(asset.id)}
                          className="rounded border-gray-300"
                        />
                        {asset.name} <span className="text-xs text-gray-500">({asset.type})</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="attachments">Attachments {selectedRequestType.requiredAttachments ? '(required)' : '(optional)'}</Label>
                <input
                  ref={fileInputRef}
                  id="attachments"
                  name="attachments"
                  type="file"
                  multiple
                  className="block w-full text-sm text-gray-700 file:mr-4 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
                />
              </div>

              <div className="flex gap-3">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting...' : 'Submit Request'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
