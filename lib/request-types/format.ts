import type { RequestFormSchema } from './validation';

function normalizeValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    const items = value
      .map((item) => (typeof item === 'string' ? item.trim() : String(item)))
      .filter((item) => item.length > 0);
    return items.length > 0 ? items.join(', ') : null;
  }
  return null;
}

export function buildRequestSubject(
  requestTypeName: string,
  payload: Record<string, unknown>
): string {
  const subjectKeys = ['subject', 'summary', 'title'];
  const subjectValue = subjectKeys
    .map((key) => normalizeValue(payload[key]))
    .find((value) => value);

  if (subjectValue) {
    return `${requestTypeName} - ${subjectValue}`;
  }

  return requestTypeName;
}

export function buildRequestDescription(
  requestTypeName: string,
  formSchema: RequestFormSchema,
  payload: Record<string, unknown>
): string {
  const lines: string[] = [`Request Type: ${requestTypeName}`];

  for (const field of formSchema.fields) {
    if (field.type === 'fileHint') {
      continue;
    }

    const value = normalizeValue(payload[field.id]);
    if (!value) {
      continue;
    }

    lines.push(`${field.label}: ${value}`);
  }

  return lines.join('\n');
}
