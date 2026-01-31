'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getInternalUsersAction } from '@/app/app/actions/users';

interface EditUserDialogProps {
  userId: string;
  currentName: string | null;
  currentEmail: string;
  currentPhone?: string | null;
  currentJobTitle?: string | null;
  currentDepartment?: string | null;
  currentNotes?: string | null;
  currentManagerId?: string | null;
  isInternal?: boolean;
  onClose: () => void;
  onUpdate: (data: {
    name: string | null;
    email: string;
    phone?: string | null;
    jobTitle?: string | null;
    department?: string | null;
    notes?: string | null;
    managerId?: string | null;
  }) => Promise<void>;
}

interface InternalUser {
  id: string;
  name: string | null;
  email: string;
  jobTitle: string | null;
  department: string | null;
}

export function EditUserDialog({
  userId,
  currentName,
  currentEmail,
  currentPhone,
  currentJobTitle,
  currentDepartment,
  currentNotes,
  currentManagerId,
  isInternal = false,
  onClose,
  onUpdate,
}: EditUserDialogProps) {
  const [name, setName] = useState(currentName || '');
  const [email, setEmail] = useState(currentEmail);
  const [phone, setPhone] = useState(currentPhone || '');
  const [jobTitle, setJobTitle] = useState(currentJobTitle || '');
  const [department, setDepartment] = useState(currentDepartment || '');
  const [notes, setNotes] = useState(currentNotes || '');
  const [managerId, setManagerId] = useState(currentManagerId || '');
  const [internalUsers, setInternalUsers] = useState<InternalUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load internal users for manager selection (only if this is an internal user)
  useEffect(() => {
    if (isInternal) {
      setIsLoadingUsers(true);
      getInternalUsersAction()
        .then((users) => {
          // Filter out the current user from the manager list
          setInternalUsers(users.filter((u) => u.id !== userId));
        })
        .catch((err) => {
          console.error('Failed to load internal users:', err);
        })
        .finally(() => {
          setIsLoadingUsers(false);
        });
    }
  }, [isInternal, userId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Email is required.');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onUpdate({
        name: name.trim() || null,
        email: email.trim(),
        phone: phone.trim() || null,
        jobTitle: jobTitle.trim() || null,
        department: department.trim() || null,
        notes: notes.trim() || null,
        managerId: managerId || null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit User Information</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name (optional)</Label>
            <Input
              id="edit-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-email">Email *</Label>
            <Input
              id="edit-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-phone">Phone (optional)</Label>
            <Input
              id="edit-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 123-4567"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-job-title">Job Title (optional)</Label>
              <Input
                id="edit-job-title"
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Software Engineer"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-department">Department (optional)</Label>
              <Input
                id="edit-department"
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Engineering"
              />
            </div>
          </div>
          {isInternal && (
            <div className="space-y-2">
              <Label htmlFor="edit-manager">Manager (optional)</Label>
              <Select value={managerId} onValueChange={setManagerId}>
                <SelectTrigger id="edit-manager">
                  <SelectValue placeholder="Select a manager" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No Manager</SelectItem>
                  {isLoadingUsers ? (
                    <SelectItem value="" disabled>Loading...</SelectItem>
                  ) : (
                    internalUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name || user.email}
                        {user.jobTitle && ` - ${user.jobTitle}`}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="edit-notes">Notes (optional)</Label>
            <textarea
              id="edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional information about this user..."
              rows={4}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={onClose} type="button">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
