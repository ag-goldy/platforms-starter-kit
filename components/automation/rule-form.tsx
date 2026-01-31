'use client';

import { useState } from 'react';
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
import { Switch } from '@/components/ui/switch';
import type { Condition, Action, TriggerOn } from '@/lib/automation/types';

interface AutomationRuleFormProps {
  initialData?: {
    name: string;
    enabled: boolean;
    priority: number;
    triggerOn: TriggerOn;
    conditions: Condition[];
    actions: Action[];
  };
  onSubmit: (data: {
    name: string;
    enabled: boolean;
    priority: number;
    triggerOn: TriggerOn;
    conditions: Condition[];
    actions: Action[];
  }) => void;
  onCancel: () => void;
}

export function AutomationRuleForm({
  initialData,
  onSubmit,
  onCancel,
}: AutomationRuleFormProps) {
  const [name, setName] = useState(initialData?.name || '');
  const [enabled, setEnabled] = useState(initialData?.enabled ?? true);
  const [priority, setPriority] = useState(initialData?.priority.toString() || '0');
  const [triggerOn, setTriggerOn] = useState<TriggerOn>(
    initialData?.triggerOn ?? 'TICKET_CREATED'
  );
  const [conditions] = useState<Condition[]>(initialData?.conditions || []);
  const [actions] = useState<Action[]>(initialData?.actions || []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      enabled,
      priority: parseInt(priority, 10),
      triggerOn,
      conditions,
      actions,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Rule Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., High Priority for Incidents"
          required
        />
      </div>

      <div className="flex items-center gap-2">
        <Switch checked={enabled} onCheckedChange={setEnabled} />
        <Label htmlFor="enabled">Enabled</Label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="priority">Priority</Label>
          <Input
            id="priority"
            type="number"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            min="0"
            required
          />
          <p className="text-xs text-muted-foreground">
            Higher priority rules run first
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="triggerOn">Trigger On</Label>
          <Select value={triggerOn} onValueChange={(value) => setTriggerOn(value as TriggerOn)}>
            <SelectTrigger id="triggerOn">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TICKET_CREATED">Ticket Created</SelectItem>
              <SelectItem value="TICKET_UPDATED">Ticket Updated</SelectItem>
              <SelectItem value="COMMENT_ADDED">Comment Added</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Conditions</Label>
        <div className="border rounded-lg p-4 bg-muted/50">
          <p className="text-sm text-muted-foreground">
            Condition builder UI coming soon. For now, rules can be configured via API.
          </p>
          {conditions.length > 0 && (
            <p className="text-sm mt-2">
              {conditions.length} condition(s) configured
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Actions</Label>
        <div className="border rounded-lg p-4 bg-muted/50">
          <p className="text-sm text-muted-foreground">
            Action builder UI coming soon. For now, rules can be configured via API.
          </p>
          {actions.length > 0 && (
            <p className="text-sm mt-2">
              {actions.length} action(s) configured
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Save Rule</Button>
      </div>
    </form>
  );
}
