'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import type { Condition, Action, TriggerOn } from '@/lib/automation/types';
import { Pencil, Trash2 } from 'lucide-react';

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

interface AutomationRuleListProps {
  rules: AutomationRule[];
  onEdit: (rule: AutomationRule) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
}

export function AutomationRuleList({
  rules,
  onEdit,
  onDelete,
  onToggle,
}: AutomationRuleListProps) {
  if (rules.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg">
        <p className="text-muted-foreground">No automation rules configured</p>
        <p className="text-sm text-muted-foreground mt-1">
          Create your first rule to automate ticket workflows
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {rules.map((rule) => (
        <div key={rule.id} className="border rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold">{rule.name}</h3>
                <Badge variant={rule.enabled ? 'default' : 'secondary'}>
                  {rule.enabled ? 'Enabled' : 'Disabled'}
                </Badge>
                <Badge variant="outline">Priority: {rule.priority}</Badge>
                <Badge variant="outline">Trigger: {rule.triggerOn}</Badge>
              </div>

              <div className="text-sm text-muted-foreground space-y-1">
                <div>
                  <span className="font-medium">Conditions:</span>{' '}
                  {rule.conditions.length === 0 ? (
                    <span>Always match</span>
                  ) : (
                    <span>{rule.conditions.length} condition(s)</span>
                  )}
                </div>
                <div>
                  <span className="font-medium">Actions:</span>{' '}
                  <span>{rule.actions.length} action(s)</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 ml-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Enabled</span>
                <Switch
                  checked={rule.enabled}
                  onCheckedChange={(checked) => onToggle(rule.id, checked)}
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(rule)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(rule.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

