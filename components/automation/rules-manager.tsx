'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  createAutomationRuleAction,
  updateAutomationRuleAction,
  deleteAutomationRuleAction,
} from '@/app/app/actions/automation';
import type { Condition, Action, TriggerOn } from '@/lib/automation/types';
import { AutomationRuleForm } from './rule-form';
import { AutomationRuleList } from './rule-list';
import { useToast } from '@/components/ui/toast';

interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  triggerOn: TriggerOn;
  conditions: Condition[];
  actions: Action[];
  createdAt: Date;
  updatedAt: Date;
}

interface AutomationRulesManagerProps {
  orgId: string;
  initialRules: AutomationRule[];
}

export function AutomationRulesManager({
  orgId,
  initialRules,
}: AutomationRulesManagerProps) {
  const [rules, setRules] = useState<AutomationRule[]>(initialRules);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const { showToast } = useToast();

  const handleCreate = async (data: {
    name: string;
    enabled: boolean;
    priority: number;
    triggerOn: TriggerOn;
    conditions: Condition[];
    actions: Action[];
  }) => {
    try {
      const newRule = await createAutomationRuleAction(orgId, data);
      setRules([...rules, { 
        ...newRule, 
        triggerOn: newRule.triggerOn as TriggerOn,
        conditions: data.conditions, 
        actions: data.actions 
      }]);
      setIsCreating(false);
      showToast('Rule created successfully', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to create rule', 'error');
    }
  };

  const handleUpdate = async (
    id: string,
    data: Partial<{
      name: string;
      enabled: boolean;
      priority: number;
      triggerOn: TriggerOn;
      conditions: Condition[];
      actions: Action[];
    }>
  ) => {
    try {
      const updated = await updateAutomationRuleAction(id, orgId, data);
      setRules(
        rules.map((r) =>
          r.id === id
            ? {
                ...r,
                ...updated,
                triggerOn: (updated.triggerOn ?? r.triggerOn) as TriggerOn,
                conditions: data.conditions ?? r.conditions,
                actions: data.actions ?? r.actions,
              }
            : r
        )
      );
      setEditingRule(null);
      showToast('Rule updated successfully', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to update rule', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this automation rule?')) {
      return;
    }

    try {
      await deleteAutomationRuleAction(id, orgId);
      setRules(rules.filter((r) => r.id !== id));
      showToast('Rule deleted successfully', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to delete rule', 'error');
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    await handleUpdate(id, { enabled });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">Rules</h2>
          <p className="text-sm text-muted-foreground">
            Automation rules run when tickets are created, updated, or commented on
          </p>
        </div>
        {!isCreating && (
          <Button onClick={() => setIsCreating(true)}>Create Rule</Button>
        )}
      </div>

      {isCreating && (
        <div className="border rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Create New Rule</h3>
            <Button variant="ghost" onClick={() => setIsCreating(false)}>
              Cancel
            </Button>
          </div>
          <AutomationRuleForm onSubmit={handleCreate} onCancel={() => setIsCreating(false)} />
        </div>
      )}

      {editingRule && (
        <div className="border rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Edit Rule</h3>
            <Button variant="ghost" onClick={() => setEditingRule(null)}>
              Cancel
            </Button>
          </div>
          <AutomationRuleForm
            initialData={editingRule}
            onSubmit={(data) => handleUpdate(editingRule.id, data)}
            onCancel={() => setEditingRule(null)}
          />
        </div>
      )}

      <AutomationRuleList
        rules={rules}
        onEdit={setEditingRule}
        onDelete={handleDelete}
        onToggle={handleToggle}
      />
    </div>
  );
}

