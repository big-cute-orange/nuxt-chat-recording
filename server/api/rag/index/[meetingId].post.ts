// POST /api/rag/index/:meetingId
// Triggers async vector indexing for a meeting. Called fire-and-forget from the frontend.

import { defineEventHandler, getRouterParam, createError, type H3Event } from 'h3'
import { and, eq } from 'drizzle-orm'
import { useDb } from '#server/utils/db'
import { meetings, ragIndexJobs } from '#server/db/schema'
import { indexMeeting } from '#server/services/rag/indexMeeting'

export default defineEventHandler(async (event: H3Event) => {
    const meetingId = getRouterParam(event, 'meetingId')

    if (!meetingId) {
        throw createError({ statusCode: 400, message: 'meetingId is required.' })
    }

    const session = await getUserSession(event)
    const userId = session?.user?.id

    if (!userId) {
        throw createError({ statusCode: 401, message: 'Login required.' })
    }

    const config = useRuntimeConfig()

    if (!config.upstashVectorUrl || !config.upstashVectorToken) {
        throw createError({ statusCode: 503, message: 'RAG service not configured.' })
    }

    if (!config.qwenApiKey) {
        throw createError({ statusCode: 503, message: 'Qwen API key not configured.' })
    }

    const db = useDb()

    const [meeting] = await db
        .select({ id: meetings.id })
        .from(meetings)
        .where(and(eq(meetings.id, meetingId), eq(meetings.userId, userId)))
        .limit(1)

    if (!meeting) {
        throw createError({ statusCode: 404, message: 'Meeting not found.' })
    }

    // Reset job status to pending if it already exists (retry scenario)
    await db
        .update(ragIndexJobs)
        .set({ status: 'pending', error: null, updatedAt: new Date().toISOString() })
        .where(eq(ragIndexJobs.meetingId, meetingId))

    try {
        await indexMeeting(meetingId, userId, {
            qwenApiKey: config.qwenApiKey,
            upstashVectorUrl: config.upstashVectorUrl,
            upstashVectorToken: config.upstashVectorToken,
        })

        return { status: 'succeeded' }
    } catch (err) {
        console.error('[RAG index] failed:', err)
        return { status: 'failed' }
    }
})
