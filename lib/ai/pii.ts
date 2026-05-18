export interface PIIRedactionResult {
  redacted: string;
  detected: boolean;
  types: string[];
  counts: Record<string, number>;
}

const PII_PATTERNS: Array<{ type: string; pattern: RegExp; replacement: string }> = [
  {
    type: 'email',
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    replacement: '[REDACTED_EMAIL]',
  },
  {
    type: 'phone',
    pattern: /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/g,
    replacement: '[REDACTED_PHONE]',
  },
  {
    type: 'credit_card',
    pattern: /\b(?:\d[ -]*?){13,19}\b/g,
    replacement: '[REDACTED_CARD]',
  },
  {
    type: 'ssn',
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    replacement: '[REDACTED_SSN]',
  },
  {
    type: 'ip_address',
    pattern: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g,
    replacement: '[REDACTED_IP]',
  },
];

export function redactPII(input: string): PIIRedactionResult {
  const counts: Record<string, number> = {};
  let redacted = input;

  for (const { type, pattern, replacement } of PII_PATTERNS) {
    redacted = redacted.replace(pattern, (match) => {
      if (isLikelyCreditCardFalsePositive(type, match)) return match;
      counts[type] = (counts[type] || 0) + 1;
      return replacement;
    });
  }

  const types = Object.keys(counts);
  return {
    redacted,
    detected: types.length > 0,
    types,
    counts,
  };
}

function isLikelyCreditCardFalsePositive(type: string, value: string): boolean {
  if (type !== 'credit_card') return false;
  const digits = value.replace(/\D/g, '');
  return digits.length < 13 || !passesLuhn(digits);
}

function passesLuhn(digits: string): boolean {
  let sum = 0;
  let double = false;

  for (let index = digits.length - 1; index >= 0; index--) {
    let value = Number(digits[index]);
    if (double) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    sum += value;
    double = !double;
  }

  return sum > 0 && sum % 10 === 0;
}
