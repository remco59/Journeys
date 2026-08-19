import { makeWorkerUtils, type WorkerUtils } from 'graphile-worker'
import { serverConfig } from '../config'

let utilsPromise: Promise<WorkerUtils> | undefined

function getUtils(): Promise<WorkerUtils> {
  if (!utilsPromise) {
    utilsPromise = makeWorkerUtils({ connectionString: serverConfig.databaseUrl })
  }
  return utilsPromise
}

export type JobPayloads = {
  'process-photo': { photoId: string }
  'cluster-journey': { journeyId: string }
}

/**
 * Thin wrapper over graphile-worker's enqueue call. Kept as its own module
 * (rather than calling addJob() at every call site) so swapping the queue
 * implementation later touches one file, not every enqueue.
 */
export async function enqueueJob<T extends keyof JobPayloads>(
  taskName: T,
  payload: JobPayloads[T],
  opts?: { jobKey?: string; runAt?: Date }
): Promise<void> {
  const utils = await getUtils()
  // graphile-worker's own generics key off a module-augmented Tasks map we
  // don't use; JobPayloads is our app-level type safety for callers instead.
  await utils.addJob(taskName as string, payload, {
    ...(opts?.jobKey ? { jobKey: opts.jobKey } : {}),
    ...(opts?.runAt ? { runAt: opts.runAt } : {})
  })
}
