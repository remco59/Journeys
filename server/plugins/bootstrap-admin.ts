import { countUsers, createUser, findUserByUsername } from '../domain/auth/users'

export default defineNitroPlugin(async () => {
  const config = useRuntimeConfig()
  if (!config.bootstrapAdminUsername || !config.bootstrapAdminPassword) {
    return
  }

  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      const existing = await findUserByUsername(config.bootstrapAdminUsername)
      if (existing) return

      const total = await countUsers()
      if (total > 0) return // never auto-create once real users exist

      await createUser({
        username: config.bootstrapAdminUsername,
        password: config.bootstrapAdminPassword,
        role: 'admin'
      })
      console.log(`[bootstrap] created initial admin user "${config.bootstrapAdminUsername}"`)
      return
    } catch (err) {
      if (attempt === 10) {
        console.error('[bootstrap] failed to ensure admin user after retries:', err)
        return
      }
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }
})
