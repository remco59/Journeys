import { z } from 'zod'

export const loginSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(255)
})
export type LoginInput = z.infer<typeof loginSchema>

export const createUserSchema = z.object({
  username: z.string().min(3).max(64).regex(/^[a-z0-9._-]+$/i, 'Letters, numbers, dots, dashes and underscores only'),
  password: z.string().min(8).max(255),
  role: z.enum(['admin', 'user']).default('user')
})
export type CreateUserInput = z.infer<typeof createUserSchema>

export const publicUserSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  role: z.enum(['admin', 'user']),
  createdAt: z.string()
})
export type PublicUser = z.infer<typeof publicUserSchema>
