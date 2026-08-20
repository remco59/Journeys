import { updateUsernameSchema } from '../../../shared/types/auth'
import { findUserByUsername, updateUsername } from '../../domain/auth/users'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const body = await readValidatedBody(event, updateUsernameSchema.parse)

  const existing = await findUserByUsername(body.username)
  if (existing && existing.id !== user.id) {
    throw createError({ statusCode: 409, statusMessage: 'Username already taken' })
  }

  return updateUsername(user.id, body.username)
})
