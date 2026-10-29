// Test helpers for schemas. Not part of the package's public API.
import type { ZodType } from 'zod';

/** Returns the first error as "path: message" (or just the message at the root), or null when valid. */
export function errorOf(schema: ZodType, value: unknown): string | null {
  const result = schema.safeParse(value);
  if (result.success) return null;
  const issue = result.error.issues[0];
  if (!issue) return 'unknown error';
  return issue.path.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message;
}
