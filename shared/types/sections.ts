import { z } from 'zod'

export const createSectionSchema = z.object({
  title: z.string().min(1).max(200),
  placeName: z.string().max(300).optional(),
  description: z.string().max(4000).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lon: z.number().min(-180).max(180).optional(),
  arrivalAt: z.string().datetime().optional(),
  departureAt: z.string().datetime().optional()
})
export type CreateSectionInput = z.infer<typeof createSectionSchema>

export const updateSectionSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  placeName: z.string().max(300).nullable().optional(),
  description: z.string().max(4000).nullable().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lon: z.number().min(-180).max(180).optional(),
  arrivalAt: z.string().datetime().nullable().optional(),
  departureAt: z.string().datetime().nullable().optional()
})
export type UpdateSectionInput = z.infer<typeof updateSectionSchema>

export const mergeSectionSchema = z.object({
  intoSectionId: z.string().uuid()
})
export type MergeSectionInput = z.infer<typeof mergeSectionSchema>

export const splitSectionSchema = z.object({
  photoIds: z.array(z.string().uuid()).min(1),
  title: z.string().min(1).max(200).optional()
})
export type SplitSectionInput = z.infer<typeof splitSectionSchema>

export const reorderSectionsSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1)
})
export type ReorderSectionsInput = z.infer<typeof reorderSectionsSchema>
