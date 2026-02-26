'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Power } from 'lucide-react';
import {
  createAssignmentRule,
  updateAssignmentRule,
  deleteAssignmentRule,
  toggleAssignmentRule,
  type AssignmentRuleInput,
} from '@/app/app/actions/assignment-rules';
import type { ticketAssignmentRules, users, internalGroups } from '@/db/schema';

type Rule = typeof ticketAssignmentRules.$inferSelect & {
  assignee?: { id: string; name: string | null; email: string } | null;
  internalGroup?: { id: string; name: string } | null;
};

interface AssignmentRulesManagerProps {
  orgId: string;
  initialRules: Rule[];
  users: { id: string; name: string | null; email: string }[];
  groups: { id: string; name: string }[];
}

const STRATEGY_LABELS: Record<string, string> = {
  specific_user: 'Specific User',
  round_robin: 'Round Robin',
  load_balance: 'Load Balance',
  group: 'Internal Group',
};

export function AssignmentRulesManager({
  orgId,
  initialRules,
  users,
  groups,
}: AssignmentRulesManagerProps) {
  const router = useRouter();
  const [rules, setRules] = useState<Rule[]>(initialRules);
  const [isOpen, setIsOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState<AssignmentRuleInput>({
    name: '',
    description: '',
    isActive: true,
    priority: 0,
    conditions: {},
    strategy: 'specific_user',
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      isActive: true,
      priority: 0,
      conditions: {},
      strategy: 'specific_user',
    });
    setEditingRule(null);
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      if (editingRule) {
        await updateAssignmentRule(orgId, editingRule.id, formData);
      } else {
        await createAssignmentRule(orgId, formData);
      }
      router.refresh();
      setIsOpen(false);
      resetForm();
    } catch (error) {
      console.error('Failed to save rule:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;
    
    try {
      await deleteAssignmentRule(orgId, ruleId);
      router.refresh();
    } catch (error) {
      console.error('Failed to delete rule:', error);
    }
  };

  const handleToggle = async (rule: Rule) => {
    try {
      await toggleAssignmentRule(orgId, rule.id, !rule.isActive);
      router.refresh();
    } catch (error) {
      console.error('Failed to toggle rule:', error);
    }
  };

  const openEdit = (rule: Rule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description || '',
      isActive: rule.isActive,
      priority: rule.priority,
      conditions: (rule.conditions as AssignmentRuleInput['conditions']) || {},
      strategy: rule.strategy as AssignmentRuleInput['strategy'],
      assigneeId: rule.assigneeId || undefined,
      internalGroupId: rule.internalGroupId || undefined,
    });
    setIsOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Assignment Rules</h2>
          <p className="text-sm text-gray-600">
            Automatically assign tickets based on conditions
          </p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Add Rule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingRule ? 'Edit Assignment Rule' : 'Create Assignment Rule'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Rule Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., High Priority Incidents"
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe when this rule applies"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                  />
                  <p className="text-xs text-gray-500">Higher priority rules are evaluated first</p>
                </div>

                <div className="space-y-2">
                  <Label>Assignment Strategy</Label>
                  <Select
                    value={formData.strategy}
                    onValueChange={(v) => setFormData({ ...formData, strategy: v as AssignmentRuleInput['strategy'] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="specific_user">Specific User</SelectItem>
                      <SelectItem value="round_robin">Round Robin</SelectItem>
                      <SelectItem value="load_balance">Load Balance</SelectItem>
                      <SelectItem value="group">Internal Group</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.strategy === 'specific_user' && (
                <div className="space-y-2">
                  <Label>Assignee</Label>
                  <Select
                    value={formData.assigneeId}
                    onValueChange={(v) => setFormData({ ...formData, assigneeId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select user" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name || user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {formData.strategy === 'group' && (
                <div className="space-y-2">
                  <Label>Internal Group</Label>
                  <Select
                    value={formData.internalGroupId}
                    onValueChange={(v) => setFormData({ ...formData, internalGroupId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select group" />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Conditions</Label>
                <div className="p-4 border rounded-lg space-y-3">
                  <div>
                    <Label className="text-sm">Priority</Label>
                    <Select
                      value={formData.conditions?.priority?.[0]}
                      onValueChange={(v) => setFormData({
                        ...formData,
                        conditions: { ...formData.conditions, priority: v ? [v as 'P1' | 'P2' | 'P3' | 'P4'] : undefined }
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Any priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="P1">P1 - Critical</SelectItem>
                        <SelectItem value="P2">P2 - High</SelectItem>
                        <SelectItem value="P3">P3 - Medium</SelectItem>
                        <SelectItem value="P4">P4 - Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-sm">Category</Label>
                    <Select
                      value={formData.conditions?.category?.[0]}
                      onValueChange={(v) => setFormData({
                        ...formData,
                        conditions: { ...formData.conditions, category: v ? [v as 'INCIDENT' | 'SERVICE_REQUEST' | 'CHANGE_REQUEST'] : undefined }
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Any category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INCIDENT">Incident</SelectItem>
                        <SelectItem value="SERVICE_REQUEST">Service Request</SelectItem>
                        <SelectItem value="CHANGE_REQUEST">Change Request</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(v) => setFormData({ ...formData, isActive: v })}
                />
                <Label>Active</Label>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={isLoading}>
                  {isLoading ? 'Saving...' : editingRule ? 'Update' : 'Create'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {rules.map((rule) => (
          <Card key={rule.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{rule.name}</span>
                    <Badge variant={rule.isActive ? 'default' : 'secondary'}>
                      {rule.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  {rule.description && (
                    <p className="text-sm text-gray-500">{rule.description}</p>
                  )}
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span>{STRATEGY_LABELS[rule.strategy]}</span>
                    <span>•</span>
                    <span>Priority: {rule.priority}</span>
                    {rule.assignee && (
                      <>
                        <span>•</span>
                        <span>Assignee: {rule.assignee.name || rule.assignee.email}</span>
                      </>
                    )}
                    {rule.internalGroup && (
                      <>
                        <span>•</span>
                        <span>Group: {rule.internalGroup.name}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggle(rule)}
                  >
                    <Power className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(rule)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(rule.id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {rules.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-gray-500">
              No assignment rules configured
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
