import { listJourneySummariesForOwner } from '../../domain/journeys/journeys'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  return listJourneySummariesForOwner(user.id)
})
