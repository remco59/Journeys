import { z } from 'zod'

export const updateActivitySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  type: z.enum(['cycling', 'hiking', 'running', 'walking', 'swimming', 'other']).optional(),
  sectionId: z.string().uuid().nullable().optional(),
  coverPhotoId: z.string().uuid().nullable().optional()
})
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>
