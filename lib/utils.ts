import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const protocol =
  process.env.NODE_ENV === 'production' ? 'https' : 'http';
export const rootDomain =
  process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000';
export const appBaseUrl =
  process.env.APP_BASE_URL || `${protocol}://${rootDomain}`;
export const supportBaseUrl =
  process.env.SUPPORT_BASE_URL || `${protocol}://${rootDomain}`;

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
