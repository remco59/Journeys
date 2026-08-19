/**
 * Plain process.env reader for anything that must also run inside the
 * worker process (server/jobs/worker.ts), which runs outside the Nitro
 * runtime and therefore cannot call useRuntimeConfig(). Nitro API routes
 * may still use useRuntimeConfig() for request-scoped needs (e.g. the
 * session cookie name), but any config touched by domain/storage/geo/job
 * code — which the worker also imports — comes from here instead, so
 * both processes agree on one source of truth.
 */
export const serverConfig = {
  databaseUrl: process.env.DATABASE_URL,
  storageDriver: (process.env.STORAGE_DRIVER || 'local') as 'local' | 's3',
  localStoragePath: process.env.LOCAL_STORAGE_PATH || './.data/photos',
  s3: {
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION,
    bucket: process.env.S3_BUCKET,
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
  },
  geocodeProvider: process.env.GEOCODE_PROVIDER || 'photon',
  geocodeBaseUrl: process.env.GEOCODE_BASE_URL || 'https://photon.komoot.io'
}
