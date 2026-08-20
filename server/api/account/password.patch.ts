import { updatePasswordSchema } from '../../../shared/types/auth'
import { findUserById, updateUserPassword } from '../../domain/auth/users'
import { hashPassword, verifyPassword } from '../../domain/auth/password'

export default defineEventHandler(async (event) => {
  const sessionUser = requireUser(event)
  const body = await readValidatedBody(event, updatePasswordSchema.parse)

  const user = await findUserById(sessionUser.id)
  const ok = user && (await verifyPassword(user.passwordHash, body.currentPassword))
  if (!ok) {
    throw createError({ statusCode: 401, statusMessage: 'Current password is incorrect' })
  }

  const newPasswordHash = await hashPassword(body.newPassword)
  await updateUserPassword(sessionUser.id, newPasswordHash)

  return { ok: true }
})
