export const INTERNAL_ROLES = ['ADMIN', 'AGENT', 'READONLY'] as const;
export const CUSTOMER_ROLES = ['CUSTOMER_ADMIN', 'REQUESTER', 'VIEWER'] as const;
export const ALL_ROLES = [...INTERNAL_ROLES, ...CUSTOMER_ROLES] as const;

export type InternalRole = (typeof INTERNAL_ROLES)[number];
export type CustomerRole = (typeof CUSTOMER_ROLES)[number];
export type UserRole = (typeof ALL_ROLES)[number];

export function isInternalRole(role: string): role is InternalRole {
  return INTERNAL_ROLES.includes(role as InternalRole);
}

export function isCustomerRole(role: string): role is CustomerRole {
  return CUSTOMER_ROLES.includes(role as CustomerRole);
}

