import { z } from 'zod'

export const createJourneySchema = z
  .object({
    title: z.string().min(1).max(200),
    description: z.string().max(4000).optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: 'endDate must be on or after startDate',
    path: ['endDate']
  })
export type CreateJourneyInput = z.infer<typeof createJourneySchema>

export const updateJourneySchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(4000).nullable().optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    coverPhotoId: z.string().uuid().nullable().optional(),
    visibility: z.enum(['private', 'shared']).optional()
  })
  .refine((v) => !v.startDate || !v.endDate || v.endDate >= v.startDate, {
    message: 'endDate must be on or after startDate',
    path: ['endDate']
  })
export type UpdateJourneyInput = z.infer<typeof updateJourneySchema>
