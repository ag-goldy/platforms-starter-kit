import { z } from 'zod';

const fieldTypeSchema = z.enum([
  'text',
  'textarea',
  'number',
  'select',
  'multiselect',
  'checkbox',
  'date',
  'fileHint',
]);

const optionSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
});

export const requestFieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: fieldTypeSchema,
  required: z.boolean().optional(),
  placeholder: z.string().optional(),
  helperText: z.string().optional(),
  options: z.array(optionSchema).optional(),
});

export const requestFormSchema = z.object({
  version: z.number().optional(),
  fields: z.array(requestFieldSchema).default([]),
});

export type RequestFormSchema = z.infer<typeof requestFormSchema>;

export interface RequestPayloadValidation {
  payload: Record<string, unknown>;
  errors: string[];
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

export function validateRequestPayload(
  schema: RequestFormSchema,
  payload: Record<string, unknown>
): RequestPayloadValidation {
  const errors: string[] = [];
  const normalized: Record<string, unknown> = {};

  for (const field of schema.fields) {
    if (field.type === 'fileHint') {
      continue;
    }

    const rawValue = payload[field.id];

    if (field.required) {
      const requiredValid = field.type === 'checkbox'
        ? rawValue === true
        : !isEmptyValue(rawValue);

      if (!requiredValid) {
        errors.push(`Field "${field.label}" is required.`);
        continue;
      }
    }

    if (rawValue === undefined || rawValue === null) {
      continue;
    }

    switch (field.type) {
      case 'text':
      case 'textarea':
      case 'select':
      case 'date': {
        if (typeof rawValue !== 'string') {
          errors.push(`Field "${field.label}" must be a string.`);
          continue;
        }
        if (field.type === 'select' && field.options?.length) {
          const allowed = new Set(field.options.map((option) => option.value));
          if (!allowed.has(rawValue)) {
            errors.push(`Field "${field.label}" has an invalid value.`);
            continue;
          }
        }
        if (field.type === 'date') {
          const parsed = new Date(rawValue);
          if (Number.isNaN(parsed.getTime())) {
            errors.push(`Field "${field.label}" must be a valid date.`);
            continue;
          }
        }
        normalized[field.id] = rawValue;
        break;
      }
      case 'number': {
        const numeric = typeof rawValue === 'number' ? rawValue : Number(rawValue);
        if (Number.isNaN(numeric)) {
          errors.push(`Field "${field.label}" must be a number.`);
          continue;
        }
        normalized[field.id] = numeric;
        break;
      }
      case 'multiselect': {
        const values = Array.isArray(rawValue) ? rawValue : [rawValue];
        const stringValues = values.filter((value) => typeof value === 'string') as string[];
        if (stringValues.length !== values.length) {
          errors.push(`Field "${field.label}" must be a list of values.`);
          continue;
        }
        if (field.options?.length) {
          const allowed = new Set(field.options.map((option) => option.value));
          const invalid = stringValues.find((value) => !allowed.has(value));
          if (invalid) {
            errors.push(`Field "${field.label}" has an invalid value.`);
            continue;
          }
        }
        normalized[field.id] = stringValues;
        break;
      }
      case 'checkbox': {
        if (typeof rawValue !== 'boolean') {
          errors.push(`Field "${field.label}" must be true or false.`);
          continue;
        }
        normalized[field.id] = rawValue;
        break;
      }
      default:
        errors.push(`Field "${field.label}" has an unsupported type.`);
    }
  }

  return { payload: normalized, errors };
}
