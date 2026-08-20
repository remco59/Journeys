import { updateSettingsSchema } from '../../shared/types/auth'
import { updateUserSettings } from '../domain/auth/users'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const body = await readValidatedBody(event, updateSettingsSchema.parse)

  const updated = await updateUserSettings(user.id, body)

  if (updated.theme !== 'system') {
    setCookie(event, 'theme', updated.theme, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
  }

  return updated
})
