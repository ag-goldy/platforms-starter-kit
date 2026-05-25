import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * All URL-building code in this project MUST use these helpers.
 * Do not read APP_BASE_URL, NEXT_PUBLIC_ROOT_DOMAIN, NEXT_PUBLIC_APP_URL, or
 * SUPPORT_BASE_URL directly from process.env to construct URLs. Env vars can
 * have trailing whitespace or newlines from Vercel that will break URL.parse().
 *
 * Use appBaseUrl(), supportBaseUrl(), and friends below.
 */

export const protocol =
  process.env.NODE_ENV === 'production' ? 'https' : 'http';
export const rootDomain =
  process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim() || 'localhost:3000';
export const appBaseUrl =
  process.env.APP_BASE_URL?.trim() || `${protocol}://${rootDomain}`;
export const supportBaseUrl =
  process.env.SUPPORT_BASE_URL?.trim() || `${protocol}://${rootDomain}`;

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
