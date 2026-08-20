import { mergeSectionSchema } from '../../../../shared/types/sections'
import { getSectionForOwner, mergeSections } from '../../../domain/sections/sections'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const sourceId = getRouterParam(event, 'id')!
  const body = await readValidatedBody(event, mergeSectionSchema.parse)

  const [source, target] = await Promise.all([
    getSectionForOwner(sourceId, user.id),
    getSectionForOwner(body.intoSectionId, user.id)
  ])
  if (!source || !target) {
    throw createError({ statusCode: 404, statusMessage: 'Section not found' })
  }
  if (source.journeyId !== target.journeyId) {
    throw createError({ statusCode: 400, statusMessage: 'Sections must belong to the same journey' })
  }
  if (source.id === target.id) {
    throw createError({ statusCode: 400, statusMessage: 'Cannot merge a section into itself' })
  }

  return mergeSections(source.id, target.id)
})
