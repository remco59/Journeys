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
  theme: z.enum(['light', 'dark', 'system']),
  distanceUnit: z.enum(['km', 'mi']),
  createdAt: z.string()
})
export type PublicUser = z.infer<typeof publicUserSchema>

export const updateSettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  distanceUnit: z.enum(['km', 'mi']).optional()
})
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>

export const updateUsernameSchema = z.object({
  username: z.string().min(3).max(64).regex(/^[a-z0-9._-]+$/i, 'Letters, numbers, dots, dashes and underscores only')
})
export type UpdateUsernameInput = z.infer<typeof updateUsernameSchema>

export const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(255),
  newPassword: z.string().min(8).max(255)
})
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>
