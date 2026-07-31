import { z } from 'zod';

export const clientCreateSchema = z.object({
  internalClientId: z.string().trim().min(1),
  legalBusinessName: z.string().trim().min(1),
  dba: z.string().trim().min(1).nullable().default(null),
  businessType: z.string().trim().min(1).nullable().default(null),
  businessWebsite: z.url().nullable().default(null),
  notificationEmail: z.email().nullable().default(null),
  authorizedContactName: z.string().trim().min(1).nullable().default(null),
  authorizationConfirmed: z.boolean().default(false),
  active: z.boolean().default(true),
});

export const clientSchema = z.object({
  id: z.uuid(),
  ...clientCreateSchema.shape,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type ClientCreate = z.infer<typeof clientCreateSchema>;
export type Client = z.infer<typeof clientSchema>;
