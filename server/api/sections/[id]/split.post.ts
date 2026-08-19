import { splitSectionSchema } from '../../../../shared/types/sections'
import { getSectionForOwner, splitSection } from '../../../domain/sections/sections'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const sectionId = getRouterParam(event, 'id')!

  const section = await getSectionForOwner(sectionId, user.id)
  if (!section) {
    throw createError({ statusCode: 404, statusMessage: 'Section not found' })
  }

  const body = await readValidatedBody(event, splitSectionSchema.parse)

  try {
    const created = await splitSection(section, body.photoIds, body.title)
    setResponseStatus(event, 201)
    return created
  } catch (err) {
    throw createError({ statusCode: 400, statusMessage: (err as Error).message })
  }
})
