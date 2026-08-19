import { z } from 'zod'

export const updateTraceSchema = z.object({
  transportMode: z.enum(['walking', 'cycling', 'car', 'train', 'bus', 'ferry', 'flight', 'unknown'])
})
export type UpdateTraceInput = z.infer<typeof updateTraceSchema>
