import { getSectionForOwner, deleteSection } from '../../domain/sections/sections'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const sectionId = getRouterParam(event, 'id')!

  const section = await getSectionForOwner(sectionId, user.id)
  if (!section) {
    throw createError({ statusCode: 404, statusMessage: 'Section not found' })
  }

  await deleteSection(sectionId, section.journeyId)
  return { ok: true }
})
