import { listUsers } from '../../domain/auth/users'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  return listUsers()
})
