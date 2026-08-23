import { z } from 'zod'

export const updatePhotoSchema = z.object({
  sectionId: z.string().uuid().nullable().optional(),
  caption: z.string().max(2000).nullable().optional(),
  capturedAt: z.string().datetime().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lon: z.number().min(-180).max(180).optional()
})
export type UpdatePhotoInput = z.infer<typeof updatePhotoSchema>

export const bulkMovePhotosSchema = z.object({
  photoIds: z.array(z.string().uuid()).min(1),
  sectionId: z.string().uuid().nullable()
})
export type BulkMovePhotosInput = z.infer<typeof bulkMovePhotosSchema>

export const bulkDeletePhotosSchema = z.object({
  photoIds: z.array(z.string().uuid()).min(1)
})
export type BulkDeletePhotosInput = z.infer<typeof bulkDeletePhotosSchema>

export const setPhotoShowInStorySchema = z.object({
  show: z.boolean()
})
export type SetPhotoShowInStoryInput = z.infer<typeof setPhotoShowInStorySchema>

export const importImmichAssetsSchema = z.object({
  assets: z.array(z.object({ assetId: z.string().uuid(), filename: z.string().min(1).max(500) })).min(1).max(200)
})
export type ImportImmichAssetsInput = z.infer<typeof importImmichAssetsSchema>
