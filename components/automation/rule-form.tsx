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
import { Badge } from '@/components/ui/badge';
import type {
  Action,
  ActionType,
  Condition,
  ConditionType,
  TriggerOn,
} from '@/lib/automation/types';
import { Plus, Trash2, Wand2 } from 'lucide-react';

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
  const [conditions, setConditions] = useState<Condition[]>(
    initialData?.conditions || [],
  );
  const [actions, setActions] = useState<Action[]>(initialData?.actions || []);
  const [newConditionType, setNewConditionType] =
    useState<ConditionType>('priority_equals');
  const [newConditionValue, setNewConditionValue] = useState('P1');
  const [newActionType, setNewActionType] =
    useState<ActionType>('assign_to_round_robin');
  const [newActionValue, setNewActionValue] = useState('');

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

  const applyP1Template = () => {
    setName(name || 'Auto-assign P1 incidents');
    setEnabled(true);
    setPriority(priority === '0' ? '100' : priority);
    setTriggerOn('TICKET_CREATED');
    setConditions([{ type: 'priority_equals', value: 'P1' }]);
    setActions([{ type: 'assign_to_round_robin', value: null }]);
  };

  const addCondition = () => {
    const value = conditionNeedsValue(newConditionType)
      ? newConditionValue.trim()
      : null;
    if (conditionNeedsValue(newConditionType) && !value) return;
    setConditions([...conditions, { type: newConditionType, value }]);
  };

  const addAction = () => {
    const value = actionNeedsValue(newActionType) ? newActionValue.trim() : null;
    if (actionNeedsValue(newActionType) && !value) return;
    setActions([...actions, { type: newActionType, value }]);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={applyP1Template}>
          <Wand2 className="mr-2 h-4 w-4" />
          P1 auto-assign template
        </Button>
      </div>

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
              <SelectItem value="STATUS_CHANGED">Status Changed</SelectItem>
              <SelectItem value="PRIORITY_CHANGED">Priority Changed</SelectItem>
              <SelectItem value="ASSIGNED">Assigned</SelectItem>
              <SelectItem value="UNASSIGNED">Unassigned</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Conditions</Label>
        <div className="space-y-3 rounded-md border p-4">
          <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)_auto]">
            <Select
              value={newConditionType}
              onValueChange={(value) =>
                setNewConditionType(value as ConditionType)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="priority_equals">Priority equals</SelectItem>
                <SelectItem value="status_equals">Status equals</SelectItem>
                <SelectItem value="category_equals">Category equals</SelectItem>
                <SelectItem value="assignee_is_null">Assignee is empty</SelectItem>
                <SelectItem value="subject_contains">Subject contains</SelectItem>
                <SelectItem value="description_contains">Description contains</SelectItem>
                <SelectItem value="tag_equals">Tag equals</SelectItem>
              </SelectContent>
            </Select>
            {conditionNeedsValue(newConditionType) ? (
              <Input
                value={newConditionValue}
                onChange={(e) => setNewConditionValue(e.target.value)}
                placeholder={conditionPlaceholder(newConditionType)}
              />
            ) : (
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                No value required
              </div>
            )}
            <Button type="button" variant="outline" onClick={addCondition}>
              <Plus className="mr-2 h-4 w-4" />
              Add
            </Button>
          </div>

          <div className="space-y-2">
            {conditions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No conditions means the rule always matches.
              </p>
            ) : (
              conditions.map((condition, index) => (
                <div
                  key={`${condition.type}-${index}`}
                  className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{condition.type}</Badge>
                    <span className="text-muted-foreground">
                      {String(condition.value ?? 'no value')}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setConditions(conditions.filter((_, i) => i !== index))
                    }
                    aria-label="Remove condition"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Actions</Label>
        <div className="space-y-3 rounded-md border p-4">
          <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)_auto]">
            <Select
              value={newActionType}
              onValueChange={(value) => setNewActionType(value as ActionType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="assign_to_round_robin">Assign round robin</SelectItem>
                <SelectItem value="assign_to">Assign to user ID</SelectItem>
                <SelectItem value="set_status">Set status</SelectItem>
                <SelectItem value="set_priority">Set priority</SelectItem>
                <SelectItem value="set_category">Set category</SelectItem>
                <SelectItem value="add_tag">Add tag</SelectItem>
                <SelectItem value="add_message">Add message</SelectItem>
                <SelectItem value="run_ai">Run AI</SelectItem>
                <SelectItem value="notify_team">Notify team</SelectItem>
              </SelectContent>
            </Select>
            {actionNeedsValue(newActionType) ? (
              <Input
                value={newActionValue}
                onChange={(e) => setNewActionValue(e.target.value)}
                placeholder={actionPlaceholder(newActionType)}
              />
            ) : (
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                No value required
              </div>
            )}
            <Button type="button" variant="outline" onClick={addAction}>
              <Plus className="mr-2 h-4 w-4" />
              Add
            </Button>
          </div>

          <div className="space-y-2">
            {actions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Add at least one action before saving the rule.
              </p>
            ) : (
              actions.map((action, index) => (
                <div
                  key={`${action.type}-${index}`}
                  className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{action.type}</Badge>
                    <span className="text-muted-foreground">
                      {String(action.value ?? 'no value')}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setActions(actions.filter((_, i) => i !== index))}
                    aria-label="Remove action"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
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

function conditionNeedsValue(type: ConditionType) {
  return type !== 'assignee_is_null';
}

function actionNeedsValue(type: ActionType) {
  return !['assign_to_round_robin', 'run_ai', 'notify_team', 'notify_assignee'].includes(type);
}

function conditionPlaceholder(type: ConditionType) {
  switch (type) {
    case 'priority_equals':
      return 'P1, P2, P3, or P4';
    case 'status_equals':
      return 'OPEN, IN_PROGRESS, WAITING_ON_CUSTOMER, RESOLVED';
    case 'category_equals':
      return 'INCIDENT, SERVICE_REQUEST, CHANGE_REQUEST';
    case 'tag_equals':
      return 'Tag name';
    default:
      return 'Match value';
  }
}

function actionPlaceholder(type: ActionType) {
  switch (type) {
    case 'assign_to':
      return 'User ID';
    case 'set_status':
      return 'OPEN, IN_PROGRESS, WAITING_ON_CUSTOMER, RESOLVED';
    case 'set_priority':
      return 'P1, P2, P3, or P4';
    case 'set_category':
      return 'INCIDENT, SERVICE_REQUEST, CHANGE_REQUEST';
    case 'add_tag':
      return 'Tag name';
    case 'add_message':
      return 'System comment text';
    default:
      return 'Action value';
  }
}
