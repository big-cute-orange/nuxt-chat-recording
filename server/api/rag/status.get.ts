// GET /api/rag/status
// Returns RAG index job statuses for all meetings of the current user.

import { defineEventHandler, type H3Event } from 'h3'
import { eq } from 'drizzle-orm'
import { useDb } from '#server/utils/db'
import { ragIndexJobs } from '#server/db/schema'

export default defineEventHandler(async (event: H3Event) => {
    const session = await getUserSession(event)
    const userId = session?.user?.id

    if (!userId) {
        return {}
    }

    const db = useDb()
    const rows = await db
        .select({ meetingId: ragIndexJobs.meetingId, status: ragIndexJobs.status })
        .from(ragIndexJobs)
        .where(eq(ragIndexJobs.userId, userId))

    const result: Record<string, string> = {}

    for (const row of rows) {
        result[row.meetingId] = row.status
    }

    return result
})
