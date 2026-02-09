'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { createUserAction } from '@/app/app/actions/users';
import { useToast } from '@/components/ui/toast';
import { Loader2, Plus, Copy, Check } from 'lucide-react';
import type { CustomerRole } from '@/lib/auth/roles';

interface Organization {
  id: string;
  name: string;
}

interface CreateUserDialogProps {
  organizations: Organization[];
}

export function CreateUserDialog({ organizations }: CreateUserDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [createdUser, setCreatedUser] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    email: '',
    name: '',
    password: '',
    isInternal: false,
    assignToOrg: false,
    orgId: '',
    role: 'REQUESTER' as CustomerRole,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await createUserAction({
        email: formData.email,
        name: formData.name,
        password: formData.password,
        isInternal: formData.isInternal,
        orgId: formData.assignToOrg ? formData.orgId : undefined,
        role: formData.assignToOrg ? formData.role : undefined,
      });

      if (result.success) {
        setCreatedUser({
          email: result.email,
          password: formData.password,
        });
        showToast('User created successfully', 'success');
      }
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Failed to create user',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCredentials = () => {
    if (createdUser) {
      navigator.clipboard.writeText(
        `Email: ${createdUser.email}\nPassword: ${createdUser.password}`
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setOpen(false);
    // Reset form after a delay
    setTimeout(() => {
      setCreatedUser(null);
      setFormData({
        email: '',
        name: '',
        password: '',
        isInternal: false,
        assignToOrg: false,
        orgId: '',
        role: 'REQUESTER',
      });
    }, 200);
  };

  if (createdUser) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>User Created Successfully</DialogTitle>
            <DialogDescription>
              The user has been created. Please copy and share these credentials securely.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-amber-900">Email:</span>
                <span className="text-sm text-amber-800">{createdUser.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-amber-900">Password:</span>
                <span className="text-sm text-amber-800 font-mono">
                  {createdUser.password}
                </span>
              </div>
            </div>

            <Button
              onClick={handleCopyCredentials}
              variant="outline"
              className="w-full"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Credentials
                </>
              )}
            </Button>
          </div>

          <Button onClick={handleClose} className="w-full">
            Done
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Create User
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
          <DialogDescription>
            Create a new user account directly. The user will be able to log in immediately.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="John Doe"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="john@example.com"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password *</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              placeholder="Min 8 characters"
              minLength={8}
              required
            />
            <p className="text-xs text-gray-500">
              Must be at least 8 characters long
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="isInternal">Internal User</Label>
              <p className="text-sm text-gray-500">
                Internal users can access the admin panel
              </p>
            </div>
            <Switch
              checked={formData.isInternal}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, isInternal: checked })
              }
            />
          </div>

          {organizations.length > 0 && (
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label>Assign to Organization</Label>
                <p className="text-sm text-gray-500">
                  Add user to an organization immediately
                </p>
              </div>
              <Switch
                checked={formData.assignToOrg}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, assignToOrg: checked })
                }
              />
            </div>
          )}

          {formData.assignToOrg && organizations.length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Organization</Label>
                <Select
                  value={formData.orgId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, orgId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select organization" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value: CustomerRole) =>
                    setFormData({ ...formData, role: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="AGENT">Agent</SelectItem>
                    <SelectItem value="REQUESTER">Requester</SelectItem>
                    <SelectItem value="VIEWER">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create User'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
