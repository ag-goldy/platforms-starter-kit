'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { RequestFormSchema } from '@/lib/request-types/validation';

interface RequestFormFieldsProps {
  schema: RequestFormSchema;
  values: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  disabled?: boolean;
}

export function RequestFormFields({
  schema,
  values,
  onChange,
  disabled = false,
}: RequestFormFieldsProps) {
  const updateValue = (fieldId: string, value: unknown) => {
    onChange({ ...values, [fieldId]: value });
  };

  return (
    <div className="space-y-4">
      {schema.fields.map((field) => {
        const fieldValue = values[field.id];
        const requiredLabel = field.required ? ' *' : '';

        if (field.type === 'fileHint') {
          return (
            <div key={field.id} className="rounded-md border border-dashed p-3 text-sm text-gray-600">
              <p className="font-medium text-gray-900">{field.label}</p>
              {field.helperText && (
                <p className="mt-1 text-xs text-gray-500">{field.helperText}</p>
              )}
            </div>
          );
        }

        switch (field.type) {
          case 'text':
          case 'number':
          case 'date': {
            return (
              <div key={field.id} className="space-y-2">
                <Label htmlFor={field.id}>
                  {field.label}
                  {requiredLabel}
                </Label>
                <Input
                  id={field.id}
                  type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
                  value={typeof fieldValue === 'string' || typeof fieldValue === 'number' ? String(fieldValue) : ''}
                  onChange={(event) => updateValue(field.id, event.target.value)}
                  placeholder={field.placeholder}
                  disabled={disabled}
                />
                {field.helperText && (
                  <p className="text-xs text-gray-500">{field.helperText}</p>
                )}
              </div>
            );
          }
          case 'textarea': {
            return (
              <div key={field.id} className="space-y-2">
                <Label htmlFor={field.id}>
                  {field.label}
                  {requiredLabel}
                </Label>
                <Textarea
                  id={field.id}
                  value={typeof fieldValue === 'string' ? fieldValue : ''}
                  onChange={(event) => updateValue(field.id, event.target.value)}
                  placeholder={field.placeholder}
                  rows={4}
                  disabled={disabled}
                />
                {field.helperText && (
                  <p className="text-xs text-gray-500">{field.helperText}</p>
                )}
              </div>
            );
          }
          case 'select': {
            const options = field.options || [];
            return (
              <div key={field.id} className="space-y-2">
                <Label htmlFor={field.id}>
                  {field.label}
                  {requiredLabel}
                </Label>
                <Select
                  value={typeof fieldValue === 'string' ? fieldValue : ''}
                  onValueChange={(value) => updateValue(field.id, value)}
                  disabled={disabled}
                >
                  <SelectTrigger id={field.id}>
                    <SelectValue placeholder={field.placeholder || 'Select an option'} />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {field.helperText && (
                  <p className="text-xs text-gray-500">{field.helperText}</p>
                )}
              </div>
            );
          }
          case 'multiselect': {
            const options = field.options || [];
            const selected = Array.isArray(fieldValue) ? fieldValue : [];
            return (
              <div key={field.id} className="space-y-2">
                <Label>
                  {field.label}
                  {requiredLabel}
                </Label>
                <div className="space-y-2 rounded-md border p-3">
                  {options.length === 0 && (
                    <p className="text-xs text-gray-500">No options configured.</p>
                  )}
                  {options.map((option) => {
                    const isChecked = selected.includes(option.value);
                    return (
                      <label key={option.value} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={(checked) => {
                            if (disabled) return;
                            const next = checked
                              ? [...selected, option.value]
                              : selected.filter((value) => value !== option.value);
                            updateValue(field.id, next);
                          }}
                          disabled={disabled}
                        />
                        {option.label}
                      </label>
                    );
                  })}
                </div>
                {field.helperText && (
                  <p className="text-xs text-gray-500">{field.helperText}</p>
                )}
              </div>
            );
          }
          case 'checkbox': {
            return (
              <div key={field.id} className="flex items-center gap-2">
                <Checkbox
                  id={field.id}
                  checked={fieldValue === true}
                  onCheckedChange={(checked) => updateValue(field.id, checked === true)}
                  disabled={disabled}
                />
                <Label htmlFor={field.id} className="text-sm font-normal">
                  {field.label}
                  {requiredLabel}
                </Label>
                {field.helperText && (
                  <span className="text-xs text-gray-500">{field.helperText}</span>
                )}
              </div>
            );
          }
          default:
            return null;
        }
      })}
    </div>
  );
}
