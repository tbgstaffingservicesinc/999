import { z } from 'zod';

export const canonicalStatusSchema = z.enum([
  'pending',
  'in_progress',
  'succeeded',
  'failed',
  'cancelled',
  'unknown',
]);

export type CanonicalStatus = z.infer<typeof canonicalStatusSchema>;
