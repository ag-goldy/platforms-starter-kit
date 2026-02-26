/**
 * Prompt Guard - Prevents prompt injection attacks across all AI interfaces
 * 
 * Detects and sanitizes malicious user inputs that attempt to:
 * - Override AI instructions
 * - Extract system prompts
 * - Access unauthorized data
 * - Manipulate AI behavior
 */

export interface PromptGuardResult {
  isSuspicious: boolean;
  threats: string[];
  sanitizedInput: string;
  shouldBlock: boolean;
}

/**
 * Detect prompt injection attempts in user input
 */
export function detectPromptInjection(userInput: string): PromptGuardResult {
  const threats: string[] = [];
  let sanitizedInput = userInput;
  let shouldBlock = false;
  
  const injectionPatterns = [
    // Direct instruction override attempts
    { pattern: /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|rules?)/gi, threat: 'instruction_override', severity: 'high' },
    { pattern: /disregard\s+(all\s+)?(previous|above|prior)/gi, threat: 'instruction_override', severity: 'high' },
    { pattern: /forget\s+(everything|all|your)\s+(instructions?|rules?|training)/gi, threat: 'instruction_override', severity: 'high' },
    { pattern: /stop\s+(following|obeying)\s+(instructions?|rules?)/gi, threat: 'instruction_override', severity: 'high' },
    
    // Role manipulation
    { pattern: /you\s+are\s+now\s+(?:a|an|the)\s+/gi, threat: 'role_manipulation', severity: 'high' },
    { pattern: /act\s+as\s+(?:a|an|the)\s+/gi, threat: 'role_manipulation', severity: 'high' },
    { pattern: /pretend\s+(?:to\s+be|you'?re)\s+/gi, threat: 'role_manipulation', severity: 'medium' },
    { pattern: /switch\s+to\s+(?:admin|developer|system|root)/gi, threat: 'privilege_escalation', severity: 'high' },
    { pattern: /become\s+(?:a|an)\s+/gi, threat: 'role_manipulation', severity: 'medium' },
    
    // System prompt extraction
    { pattern: /(?:show|reveal|display|print|output|repeat)\s+(?:your|the|system)\s+(?:prompt|instructions?|rules?|system\s+message)/gi, threat: 'prompt_extraction', severity: 'medium' },
    { pattern: /what\s+(?:are|is)\s+your\s+(?:system\s+)?(?:prompt|instructions?|rules?)/gi, threat: 'prompt_extraction', severity: 'medium' },
    { pattern: /tell\s+me\s+your\s+(?:system|initial)\s+/gi, threat: 'prompt_extraction', severity: 'medium' },
    { pattern: /repeat\s+(?:everything|all)\s+(?:you|you've)\s+(?:said|written)/gi, threat: 'prompt_extraction', severity: 'medium' },
    
    // Data exfiltration attempts
    { pattern: /(?:list|show|give|tell)\s+(?:me\s+)?(?:all|every)\s+(?:users?|customers?|organizations?|tenants?|tickets?|emails?)/gi, threat: 'data_exfiltration', severity: 'high' },
    { pattern: /(?:dump|export|extract)\s+(?:the\s+)?(?:database|data|records?|table)/gi, threat: 'data_exfiltration', severity: 'high' },
    { pattern: /(?:show|list)\s+all\s+(?:entries?|rows?|records?)/gi, threat: 'data_exfiltration', severity: 'high' },
    { pattern: /SELECT\s+\*\s+FROM/gi, threat: 'sql_injection', severity: 'high' },
    
    // Encoding tricks
    { pattern: /(?:base64|hex|rot13|binary)\s*(?:decode|encode)/gi, threat: 'encoding_attack', severity: 'medium' },
    { pattern: /decode\s+this[:\s]/gi, threat: 'encoding_attack', severity: 'medium' },
    
    // Delimiter manipulation  
    { pattern: /```(?:system|assistant|admin|user)/gi, threat: 'delimiter_injection', severity: 'high' },
    { pattern: /<\/?(?:system|admin|internal|prompt)>/gi, threat: 'tag_injection', severity: 'high' },
    { pattern: /\[SYSTEM\]|\[ADMIN\]|\[PROMPT\]/gi, threat: 'delimiter_injection', severity: 'medium' },
    
    // Cross-tenant probing
    { pattern: /(?:other|different|another)\s+(?:organization|tenant|company|customer)/gi, threat: 'cross_tenant_probe', severity: 'medium' },
    { pattern: /(?:switch|change|access)\s+(?:to\s+)?(?:organization|tenant|company)/gi, threat: 'cross_tenant_probe', severity: 'high' },
    { pattern: /(?:show|list)\s+(?:other|all)\s+(?:orgs?|organizations?|tenants?)/gi, threat: 'cross_tenant_probe', severity: 'high' },
    
    // Context window attacks
    { pattern: /DAN\s+mode|jailbreak|"developer"\s+mode/gi, threat: 'jailbreak_attempt', severity: 'high' },
    { pattern: /bypass\s+(?:your|the)\s+(?:filter|rules|restrictions)/gi, threat: 'jailbreak_attempt', severity: 'high' },
    { pattern: /override\s+(?:your|the|system)/gi, threat: 'jailbreak_attempt', severity: 'high' },
    { pattern: /do\s+anything\s+now/gi, threat: 'jailbreak_attempt', severity: 'high' },
  ];
  
  for (const { pattern, threat, severity } of injectionPatterns) {
    if (pattern.test(userInput)) {
      threats.push(threat);
      if (severity === 'high') {
        shouldBlock = true;
      }
    }
  }
  
  // Sanitize: strip common injection delimiters but preserve the actual question
  sanitizedInput = sanitizedInput
    .replace(/```[a-z]*/g, '')      // Remove code block language hints used as delimiters
    .replace(/<\/?[a-z]+>/gi, '')   // Remove HTML-like tags
    .replace(/\[SYSTEM\]|\[ADMIN\]|\[PROMPT\]/gi, '')
    .trim();
  
  // Length limit — extremely long inputs are suspicious
  if (sanitizedInput.length > 4000) {
    threats.push('excessive_length');
    shouldBlock = true;
    sanitizedInput = sanitizedInput.substring(0, 4000);
  }
  
  // Repetition check — repeated phrases can be used for DoS or confusion
  const words = sanitizedInput.toLowerCase().split(/\s+/);
  const uniqueWords = new Set(words);
  if (words.length > 50 && uniqueWords.size / words.length < 0.3) {
    threats.push('repetition_attack');
  }
  
  return {
    isSuspicious: threats.length > 0,
    threats,
    sanitizedInput,
    shouldBlock,
  };
}

/**
 * Generate a safe response for blocked/suspicious inputs
 */
export function getSafeResponse(threats: string[]): string {
  // Generic safe responses that don't reveal what was detected
  const safeResponses = [
    "I'm here to help with support questions. Could you rephrase that?",
    "I can assist with your support inquiries. What would you like help with?",
    "I'm focused on providing helpful support. How can I assist you today?",
    "I understand you're looking for help. What specific support question do you have?",
  ];
  
  // For high-severity threats, use a more generic response
  if (threats.includes('instruction_override') || threats.includes('jailbreak_attempt')) {
    return "I'm here to help with support questions. What can I assist you with?";
  }
  
  return safeResponses[Math.floor(Math.random() * safeResponses.length)];
}

/**
 * Log security event for audit trail
 */
export function logSecurityEvent(
  event: string,
  details: {
    threats?: string[];
    userId?: string | null;
    orgId?: string | null;
    interface: string;
    ipAddress: string;
    inputLength: number;
  }
): void {
  console.log('[AI Security]', {
    event,
    timestamp: new Date().toISOString(),
    ...details,
  });
}
