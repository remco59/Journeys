import { listSectionsForOwner } from '../../../domain/sections/sections'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const journeyId = getRouterParam(event, 'id')!
  return listSectionsForOwner(journeyId, user.id)
})
