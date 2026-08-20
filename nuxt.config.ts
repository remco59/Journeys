import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-06-01',
  devtools: { enabled: true },
  modules: ['@pinia/nuxt'],
  app: {
    head: {
      viewport: 'width=device-width, initial-scale=1, viewport-fit=cover'
    }
  },
  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [tailwindcss()]
  },
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
      tileProviderUrl: process.env.TILE_PROVIDER_URL || 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      tileAttribution: process.env.TILE_ATTRIBUTION || '© OpenStreetMap contributors © CARTO'
    }
  },
  nitro: {
    experimental: { asyncContext: true }
  },
  // Precautionary: typed pages' route-matching type is a known source of
  // "Excessive stack depth" (TS2321) once an app has many dynamic routes
  // (we already hit that class of issue via $fetch's own typed routes —
  // see the comment in app/stores/auth.ts). We don't use typed route
  // params anywhere, so there's no upside to leaving it enabled.
  experimental: { typedPages: false },
  typescript: {
    strict: true
  }
})
