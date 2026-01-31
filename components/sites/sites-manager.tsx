'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Area, Site } from '@/db/schema';
import { SiteDialog } from '@/components/sites/site-dialog';
import { AreaDialog } from '@/components/sites/area-dialog';
import { toggleSiteActiveAction, toggleAreaActiveAction } from '@/app/app/actions/sites';
import { useRouter } from 'next/navigation';

interface SiteWithAreas extends Site {
  areas: Area[];
}

interface SitesManagerProps {
  orgId: string;
  sites: SiteWithAreas[];
}

export function SitesManager({ orgId, sites }: SitesManagerProps) {
  const router = useRouter();
  const [isCreatingSite, setIsCreatingSite] = useState(false);
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);
  const [creatingAreaSiteId, setCreatingAreaSiteId] = useState<string | null>(null);
  const [editingArea, setEditingArea] = useState<{ siteId: string; areaId: string } | null>(null);
  const [togglingSiteId, setTogglingSiteId] = useState<string | null>(null);
  const [togglingAreaId, setTogglingAreaId] = useState<string | null>(null);

  const handleToggleSite = async (site: Site) => {
    setTogglingSiteId(site.id);
    try {
      await toggleSiteActiveAction(orgId, site.id, !site.isActive);
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update site');
    } finally {
      setTogglingSiteId(null);
    }
  };

  const handleToggleArea = async (area: Area) => {
    setTogglingAreaId(area.id);
    try {
      await toggleAreaActiveAction(orgId, area.id, !area.isActive);
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update area');
    } finally {
      setTogglingAreaId(null);
    }
  };

  if (sites.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-gray-500">No sites yet. Add your first location.</p>
          <Button className="mt-4" onClick={() => setIsCreatingSite(true)}>
            Create Site
          </Button>
          {isCreatingSite && (
            <SiteDialog orgId={orgId} onClose={() => setIsCreatingSite(false)} />
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Sites & Areas</h2>
          <p className="text-sm text-gray-600">Manage locations and service areas.</p>
        </div>
        <Button onClick={() => setIsCreatingSite(true)}>Create Site</Button>
      </div>

      <div className="space-y-4">
        {sites.map((site) => (
          <Card key={site.id} className={!site.isActive ? 'opacity-70' : undefined}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                {site.name}
                {!site.isActive && <Badge variant="secondary">Inactive</Badge>}
              </CardTitle>
              <p className="text-xs text-gray-500">{site.slug}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-gray-600 space-y-1">
                {site.address && <p>{site.address}</p>}
                {site.timezone && <p>Timezone: {site.timezone}</p>}
                {site.notes && <p>{site.notes}</p>}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditingSiteId(site.id)}>
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleSite(site)}
                  disabled={togglingSiteId === site.id}
                >
                  {togglingSiteId === site.id
                    ? 'Updating...'
                    : site.isActive
                    ? 'Disable'
                    : 'Enable'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCreatingAreaSiteId(site.id)}>
                  Add Area
                </Button>
              </div>

              <div className="border-t pt-3 space-y-2">
                <div className="text-xs uppercase text-gray-500">Areas</div>
                {site.areas.length === 0 ? (
                  <p className="text-sm text-gray-500">No areas defined.</p>
                ) : (
                  <div className="space-y-2">
                    {site.areas.map((area) => (
                      <div key={area.id} className="flex items-center justify-between rounded-md border p-2">
                        <div>
                          <p className="text-sm font-medium">{area.name}</p>
                          {area.floor && <p className="text-xs text-gray-500">Floor: {area.floor}</p>}
                          {!area.isActive && (
                            <p className="text-xs text-gray-500">Inactive</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingArea({ siteId: site.id, areaId: area.id })}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleArea(area)}
                            disabled={togglingAreaId === area.id}
                          >
                            {togglingAreaId === area.id
                              ? 'Updating...'
                              : area.isActive
                              ? 'Disable'
                              : 'Enable'}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {isCreatingSite && (
        <SiteDialog orgId={orgId} onClose={() => setIsCreatingSite(false)} />
      )}
      {editingSiteId && (
        <SiteDialog
          orgId={orgId}
          initialData={sites.find((site) => site.id === editingSiteId) || null}
          onClose={() => setEditingSiteId(null)}
        />
      )}
      {creatingAreaSiteId && (
        <AreaDialog
          orgId={orgId}
          siteId={creatingAreaSiteId}
          onClose={() => setCreatingAreaSiteId(null)}
        />
      )}
      {editingArea && (
        <AreaDialog
          orgId={orgId}
          siteId={editingArea.siteId}
          initialData={
            sites
              .find((site) => site.id === editingArea.siteId)
              ?.areas.find((area) => area.id === editingArea.areaId) || null
          }
          onClose={() => setEditingArea(null)}
        />
      )}
    </div>
  );
}
