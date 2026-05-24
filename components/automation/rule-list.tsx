'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import type { Condition, Action, TriggerOn } from '@/lib/automation/types';
import { Pencil, PlayCircle, Trash2 } from 'lucide-react';

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
        <PlayCircle className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="font-medium">No automation rules configured</p>
        <p className="text-sm text-muted-foreground mt-1">
          Create your first rule to automate ticket workflows
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {rules.map((rule) => (
        <div key={rule.id} className="rounded-md border border-slate-200 p-4 dark:border-slate-800">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">{rule.name}</h3>
                <Badge variant={rule.enabled ? 'default' : 'secondary'}>
                  {rule.enabled ? 'Enabled' : 'Disabled'}
                </Badge>
                <Badge variant="outline">Priority {rule.priority}</Badge>
                <Badge variant="outline">{formatTrigger(rule.triggerOn)}</Badge>
              </div>

              <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                <div className="rounded-md bg-muted/40 px-3 py-2">
                  <span className="font-medium text-foreground">Conditions</span>
                  <div>
                    {rule.conditions.length === 0
                      ? 'Always match'
                      : `${rule.conditions.length} configured`}
                  </div>
                </div>
                <div className="rounded-md bg-muted/40 px-3 py-2">
                  <span className="font-medium text-foreground">Actions</span>
                  <div>{rule.actions.length} configured</div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 lg:ml-4">
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

function formatTrigger(trigger: TriggerOn) {
  return trigger
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
