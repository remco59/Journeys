import { run } from 'graphile-worker'
import { serverConfig } from '../config'
import { processPhotoTask } from './tasks/process-photo'
import { clusterJourneyTask } from './tasks/cluster-journey'

async function main() {
  if (!serverConfig.databaseUrl) {
    throw new Error('DATABASE_URL is not set')
  }

  console.log('[worker] starting…')

  const runner = await run({
    connectionString: serverConfig.databaseUrl,
    concurrency: 4,
    taskList: {
      'process-photo': processPhotoTask,
      'cluster-journey': clusterJourneyTask
    }
  })

  console.log('[worker] ready, listening for jobs')
  await runner.promise
}

main().catch((err) => {
  console.error('[worker] crashed:', err)
  process.exit(1)
})
