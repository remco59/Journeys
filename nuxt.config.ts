export default defineNuxtConfig({
  compatibilityDate: '2025-06-01',
  devtools: { enabled: true },
  modules: ['@pinia/nuxt'],
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL,
    sessionCookieName: process.env.SESSION_COOKIE_NAME || 'journeys_session',
    sessionTtlDays: Number(process.env.SESSION_TTL_DAYS || 30),
    storageDriver: process.env.STORAGE_DRIVER || 'local',
    localStoragePath: process.env.LOCAL_STORAGE_PATH || './.data/photos',
    bootstrapAdminUsername: process.env.BOOTSTRAP_ADMIN_USERNAME,
    bootstrapAdminPassword: process.env.BOOTSTRAP_ADMIN_PASSWORD,
    geocodeProvider: process.env.GEOCODE_PROVIDER || 'photon',
    geocodeBaseUrl: process.env.GEOCODE_BASE_URL || 'https://photon.komoot.io',
    s3: {
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION,
      bucket: process.env.S3_BUCKET,
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
    },
    public: {
      tileProviderUrl: process.env.TILE_PROVIDER_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      tileAttribution: process.env.TILE_ATTRIBUTION || '© OpenStreetMap contributors'
    }
  },
  nitro: {
    experimental: { asyncContext: true }
  },
  typescript: {
    strict: true
  }
})
