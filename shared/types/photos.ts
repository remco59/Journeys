import { z } from 'zod'

export const updatePhotoSchema = z.object({
  sectionId: z.string().uuid().nullable().optional(),
  caption: z.string().max(2000).nullable().optional(),
  capturedAt: z.string().datetime().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lon: z.number().min(-180).max(180).optional()
})
export type UpdatePhotoInput = z.infer<typeof updatePhotoSchema>
