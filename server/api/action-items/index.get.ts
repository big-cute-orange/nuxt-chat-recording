/**
 * GET /api/action-items?meetingId=...
 * Fetch action items for a meeting
 */
import { defineEventHandler, getQuery, createError, type H3Event } from 'h3'
import { useDb } from '#server/utils/db'
import { actionItems } from '#server/db/schema'
import { eq, and, isNull } from 'drizzle-orm'

export default defineEventHandler(async (event: H3Event) => {
    const db = useDb()
    const session = await getUserSession(event)
    const userId = session?.user?.id || null
    const { meetingId } = getQuery(event)

    if (!meetingId) {
        throw createError({
            statusCode: 400,
            message: 'meetingId query parameter required',
        })
    }

    const items = await db
        .select()
        .from(actionItems)
        .where(and(eq(actionItems.meetingId, meetingId as string), userId ? eq(actionItems.userId, userId) : isNull(actionItems.userId)))
        .orderBy(actionItems.createdAt)

    return items
})
