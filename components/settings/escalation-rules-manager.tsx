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
import { Plus, Edit, Trash2, Power, Clock } from 'lucide-react';
import {
  createEscalationRule,
  updateEscalationRule,
  deleteEscalationRule,
  toggleEscalationRule,
  formatDuration,
  type EscalationRuleInput,
} from '@/app/app/actions/escalation-rules';
import type { escalationRules } from '@/db/schema';

type Rule = typeof escalationRules.$inferSelect;

interface EscalationRulesManagerProps {
  orgId: string;
  initialRules: Rule[];
  users: { id: string; name: string | null; email: string }[];
  groups: { id: string; name: string }[];
}

const TRIGGER_LABELS: Record<string, string> = {
  no_response: 'No Response',
  no_resolution: 'No Resolution',
  sla_warning: 'SLA Warning',
  sla_breach: 'SLA Breach',
};

export function EscalationRulesManager({
  orgId,
  initialRules,
  users,
  groups,
}: EscalationRulesManagerProps) {
  const router = useRouter();
  const [rules, setRules] = useState<Rule[]>(initialRules);
  const [isOpen, setIsOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState<EscalationRuleInput>({
    name: '',
    description: '',
    isActive: true,
    triggerType: 'no_response',
    timeThreshold: 60,
    applicablePriorities: ['P1', 'P2', 'P3', 'P4'],
    applicableCategories: ['INCIDENT', 'SERVICE_REQUEST', 'CHANGE_REQUEST'],
    actions: {},
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      isActive: true,
      triggerType: 'no_response',
      timeThreshold: 60,
      applicablePriorities: ['P1', 'P2', 'P3', 'P4'],
      applicableCategories: ['INCIDENT', 'SERVICE_REQUEST', 'CHANGE_REQUEST'],
      actions: {},
    });
    setEditingRule(null);
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      if (editingRule) {
        await updateEscalationRule(orgId, editingRule.id, formData);
      } else {
        await createEscalationRule(orgId, formData);
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
      await deleteEscalationRule(orgId, ruleId);
      router.refresh();
    } catch (error) {
      console.error('Failed to delete rule:', error);
    }
  };

  const handleToggle = async (rule: Rule) => {
    try {
      await toggleEscalationRule(orgId, rule.id, !rule.isActive);
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
      triggerType: rule.triggerType as EscalationRuleInput['triggerType'],
      timeThreshold: rule.timeThreshold,
      applicablePriorities: rule.applicablePriorities as ('P1' | 'P2' | 'P3' | 'P4')[],
      applicableCategories: rule.applicableCategories as ('INCIDENT' | 'SERVICE_REQUEST' | 'CHANGE_REQUEST')[],
      actions: (rule.actions as EscalationRuleInput['actions']) || {},
    });
    setIsOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Escalation Rules</h2>
          <p className="text-sm text-gray-600">
            Automatically escalate tickets based on time conditions
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
                {editingRule ? 'Edit Escalation Rule' : 'Create Escalation Rule'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Rule Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Escalate Unresponded P1 Tickets"
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe when and how this rule escalates tickets"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Trigger Type</Label>
                  <Select
                    value={formData.triggerType}
                    onValueChange={(v) => setFormData({ ...formData, triggerType: v as EscalationRuleInput['triggerType'] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no_response">No Response</SelectItem>
                      <SelectItem value="no_resolution">No Resolution</SelectItem>
                      <SelectItem value="sla_warning">SLA Warning</SelectItem>
                      <SelectItem value="sla_breach">SLA Breach</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Time Threshold</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={1}
                      value={formData.timeThreshold}
                      onChange={(e) => setFormData({ ...formData, timeThreshold: parseInt(e.target.value) || 1 })}
                    />
                    <span className="flex items-center text-sm text-gray-500">minutes</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Actions</Label>
                <div className="p-4 border rounded-lg space-y-3">
                  <div>
                    <Label className="text-sm">Change Priority To</Label>
                    <Select
                      value={formData.actions?.changePriority}
                      onValueChange={(v) => setFormData({
                        ...formData,
                        actions: { ...formData.actions, changePriority: v as 'P1' | 'P2' | 'P3' | 'P4' }
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="No change" />
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
                    <Label className="text-sm">Assign To</Label>
                    <Select
                      value={formData.actions?.assignToUserId}
                      onValueChange={(v) => setFormData({
                        ...formData,
                        actions: { ...formData.actions, assignToUserId: v }
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Don't change" />
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

                  <div>
                    <Label className="text-sm">Add Comment</Label>
                    <Textarea
                      value={formData.actions?.addComment || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        actions: { ...formData.actions, addComment: e.target.value }
                      })}
                      placeholder="e.g., This ticket has been escalated due to no response"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Applicable Priorities</Label>
                  <div className="flex flex-wrap gap-2">
                    {(['P1', 'P2', 'P3', 'P4'] as const).map((p) => (
                      <Badge
                        key={p}
                        variant={formData.applicablePriorities?.includes(p) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => {
                          const current = formData.applicablePriorities || [];
                          const updated = current.includes(p)
                            ? current.filter((x) => x !== p)
                            : [...current, p];
                          setFormData({ ...formData, applicablePriorities: updated });
                        }}
                      >
                        {p}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Applicable Categories</Label>
                  <div className="flex flex-wrap gap-2">
                    {(['INCIDENT', 'SERVICE_REQUEST', 'CHANGE_REQUEST'] as const).map((c) => (
                      <Badge
                        key={c}
                        variant={formData.applicableCategories?.includes(c) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => {
                          const current = formData.applicableCategories || [];
                          const updated = current.includes(c)
                            ? current.filter((x) => x !== c)
                            : [...current, c];
                          setFormData({ ...formData, applicableCategories: updated });
                        }}
                      >
                        {c.replace('_', ' ')}
                      </Badge>
                    ))}
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
                    <span>{TRIGGER_LABELS[rule.triggerType]}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDuration(rule.timeThreshold)}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {(rule.applicablePriorities as string[])?.map((p) => (
                      <Badge key={p} variant="outline" className="text-xs">
                        {p}
                      </Badge>
                    ))}
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
              No escalation rules configured
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
