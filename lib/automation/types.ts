/**
 * Automation rules types and interfaces
 */

export type TriggerOn = 
  | 'TICKET_CREATED' 
  | 'TICKET_UPDATED' 
  | 'COMMENT_ADDED'
  | 'STATUS_CHANGED'
  | 'PRIORITY_CHANGED'
  | 'ASSIGNED'
  | 'UNASSIGNED';

export type ConditionType =
  | 'status_equals'
  | 'status_in'
  | 'priority_equals'
  | 'priority_in'
  | 'category_equals'
  | 'assignee_is'
  | 'assignee_is_null'
  | 'subject_contains'
  | 'description_contains'
  | 'tag_equals'
  | 'created_after'
  | 'created_before';

export type ActionType =
  | 'set_status'
  | 'set_priority'
  | 'set_category'
  | 'assign_to'
  | 'assign_to_round_robin'
  | 'add_tag'
  | 'remove_tag'
  | 'notify_assignee'
  | 'notify_team';

export interface Condition {
  type: ConditionType;
  value: string | string[] | number | Date | null;
}

export interface Action {
  type: ActionType;
  value: string | string[] | null;
}

export interface AutomationRule {
  id: string;
  orgId: string;
  name: string;
  enabled: boolean;
  priority: number;
  triggerOn: TriggerOn;
  conditions: Condition[];
  actions: Action[];
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

