import { checkDbConnection } from '../db/client'

export default defineEventHandler(async (event) => {
  try {
    await checkDbConnection()
    return { status: 'ok', db: 'connected', time: new Date().toISOString() }
  } catch (err) {
    setResponseStatus(event, 503)
    return { status: 'error', db: 'unreachable', message: (err as Error).message }
  }
})
