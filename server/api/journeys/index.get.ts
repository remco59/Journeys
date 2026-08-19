import { listJourneysForOwner } from '../../domain/journeys/journeys'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  return listJourneysForOwner(user.id)
})
