'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { Download, Shield, Trash2 } from 'lucide-react';
import {
  exportOrgDataAction,
  anonymizeUserDataAction,
  deleteUserDataAction,
} from '@/app/app/actions/compliance';

interface ComplianceManagerProps {
  orgId: string;
  orgName: string;
}

export function ComplianceManager({ orgId, orgName }: ComplianceManagerProps) {
  const [email, setEmail] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isAnonymizing, setIsAnonymizing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { showToast } = useToast();

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await exportOrgDataAction(orgId);
      if (result.success && result.files) {
        // Download each file
        const files = result.files;
        const fileNames = [
          'organization.json',
          'tickets.json',
          'comments.json',
          'attachments.json',
          'request-types.json',
          'sites.json',
          'areas.json',
          'assets.json',
          'ticket-assets.json',
          'notices.json',
          'export-requests.json',
          'audit-logs.json',
        ];
        const fileUrls = [
          files.organization,
          files.tickets,
          files.comments,
          files.attachments,
          files.requestTypes,
          files.sites,
          files.areas,
          files.assets,
          files.ticketAssets,
          files.notices,
          files.exportRequests,
          files.auditLogs,
        ];
        
        // Create download links
        fileUrls.forEach((url, index) => {
          const link = document.createElement('a');
          link.href = url;
          link.download = fileNames[index];
          link.click();
        });
        
        showToast('Export files downloaded successfully', 'success');
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to export data', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleAnonymize = async () => {
    if (!email.trim()) {
      showToast('Please enter an email address', 'error');
      return;
    }

    if (!confirm(`Are you sure you want to anonymize all data for ${email}? This action cannot be undone.`)) {
      return;
    }

    setIsAnonymizing(true);
    try {
      const result = await anonymizeUserDataAction(email.trim(), orgId);
      showToast(`Anonymized ${result.anonymized} tickets for ${email}`, 'success');
      setEmail('');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to anonymize data', 'error');
    } finally {
      setIsAnonymizing(false);
    }
  };

  const handleDelete = async () => {
    if (!email.trim()) {
      showToast('Please enter an email address', 'error');
      return;
    }

    if (!confirm(`Are you sure you want to delete all data for ${email}? This action cannot be undone.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const result = await deleteUserDataAction(email.trim(), orgId);
      showToast(`Deleted ${result.deleted} tickets for ${email}`, 'success');
      setEmail('');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to delete data', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Data Export</CardTitle>
          <CardDescription>
            Export all organization data in JSON format for compliance or backup
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            This will generate JSON files containing all tickets, comments, attachments metadata, and audit logs for {orgName}.
          </p>
          <Button onClick={handleExport} disabled={isExporting}>
            <Download className="mr-2 h-4 w-4" />
            {isExporting ? 'Exporting...' : 'Export All Data'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Right to Anonymize (GDPR)</CardTitle>
          <CardDescription>
            Anonymize all data for a specific user by email address
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="anonymize-email">User Email</Label>
            <Input
              id="anonymize-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
            />
            <p className="text-sm text-gray-500">
              All tickets and comments for this email will be anonymized. The ticket structure will be preserved for audit purposes.
            </p>
          </div>
          <Button onClick={handleAnonymize} disabled={isAnonymizing || !email.trim()} variant="outline">
            <Shield className="mr-2 h-4 w-4" />
            {isAnonymizing ? 'Anonymizing...' : 'Anonymize User Data'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Right to Delete (GDPR)</CardTitle>
          <CardDescription>
            Soft delete all data for a specific user by email address
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="delete-email">User Email</Label>
            <Input
              id="delete-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
            />
            <p className="text-sm text-gray-500">
              All tickets and comments for this email will be soft-deleted. Data can be recovered if needed.
            </p>
          </div>
          <Button onClick={handleDelete} disabled={isDeleting || !email.trim()} variant="destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            {isDeleting ? 'Deleting...' : 'Delete User Data'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
