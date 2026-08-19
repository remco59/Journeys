import { updateSectionSchema } from '../../../shared/types/sections'
import { getSectionForOwner, updateSectionFields } from '../../domain/sections/sections'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const sectionId = getRouterParam(event, 'id')!

  const section = await getSectionForOwner(sectionId, user.id)
  if (!section) {
    throw createError({ statusCode: 404, statusMessage: 'Section not found' })
  }

  const body = await readValidatedBody(event, updateSectionSchema.parse)
  return updateSectionFields(section, body)
})
