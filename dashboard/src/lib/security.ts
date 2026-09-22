/**
 * Security utilities — returnTo URL sanitization, path validation.
 * MUST #2: Must start with single '/', never '//' or absolute URL.
 * If logged-in role's prefix doesn't match returnTo, redirect to role's home.
 */
import { AuthRole } from '../api/auth';
import { ROLE_HOME_PATHS, ROLE_PREFIXES } from '../types/permissions';

export function sanitizeReturnTo(returnTo: string | null | undefined, role: AuthRole): string {
  const fallback = ROLE_HOME_PATHS[role] || '/';

  if (!returnTo || typeof returnTo !== 'string') {
    return fallback;
  }

  const trimmed = returnTo.trim();

  // Must start with single '/', never '//'
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return fallback;
  }

  // Reject protocol, javascript:, data:, or host specifiers
  if (trimmed.includes('://') || trimmed.includes('\\') || trimmed.toLowerCase().startsWith('/\\')) {
    return fallback;
  }

  // Extract path portion before query/hash for prefix verification
  const pathname = trimmed.split('?')[0].split('#')[0];

  const allowedPrefix = ROLE_PREFIXES[role];
  if (!allowedPrefix) {
    return fallback;
  }

  // Path must match role prefix exactly or as a subpath (e.g. /manager or /manager/*)
  const isMatch = pathname === allowedPrefix || pathname.startsWith(allowedPrefix + '/');
  if (!isMatch) {
    return fallback;
  }

  return trimmed;
}
