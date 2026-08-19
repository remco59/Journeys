import { createUserSchema } from '../../../shared/types/auth'
import { createUser, findUserByUsername } from '../../domain/auth/users'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const body = await readValidatedBody(event, createUserSchema.parse)

  const existing = await findUserByUsername(body.username)
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'Username already taken' })
  }

  const user = await createUser(body)
  setResponseStatus(event, 201)
  return user
})
