import { clusterJourney } from '../../domain/sections/cluster-journey'
import type { JobPayloads } from '../queue'

export async function clusterJourneyTask(payload: JobPayloads['cluster-journey']): Promise<void> {
  await clusterJourney(payload.journeyId)
}
