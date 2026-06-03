import { eq, and } from 'drizzle-orm'
import { useDb } from '#server/utils/db'
import { meetings, ragIndexJobs } from '#server/db/schema'
import { MeetingSummarySchema } from '~~/shared/schemas/meeting'
import { buildChunks } from './chunk'
import { embedTexts } from './embedding'
import { upsertChunks, deleteMeetingVectors } from './vector'

interface IndexConfig {
    qwenApiKey: string
    upstashVectorUrl: string
    upstashVectorToken: string
}

export async function indexMeeting(meetingId: string, userId: string, config: IndexConfig): Promise<void> {
    const db = useDb()
    const now = new Date().toISOString()

    const [existingJob] = await db
        .select({ chunkIds: ragIndexJobs.chunkIds })
        .from(ragIndexJobs)
        .where(and(eq(ragIndexJobs.meetingId, meetingId), eq(ragIndexJobs.userId, userId)))
        .limit(1)

    await db
        .update(ragIndexJobs)
        .set({ status: 'running', updatedAt: now })
        .where(and(eq(ragIndexJobs.meetingId, meetingId), eq(ragIndexJobs.userId, userId)))

    try {
        const [meeting] = await db
            .select()
            .from(meetings)
            .where(and(eq(meetings.id, meetingId), eq(meetings.userId, userId)))
            .limit(1)

        if (!meeting) throw new Error('Meeting not found.')

        let summaryData

        try {
            const parsed = MeetingSummarySchema.safeParse(JSON.parse(meeting.summary))

            if (!parsed.success) throw new Error('Invalid summary structure.')
            summaryData = parsed.data
        } catch {
            throw new Error('Failed to parse meeting summary.')
        }

        const chunks = await buildChunks(meetingId, userId, meeting.date, meeting.meetingType, summaryData, meeting.transcript)

        if (chunks.length === 0) throw new Error('No chunks generated.')

        const vectors = await embedTexts(
            chunks.map((c) => c.text),
            config.qwenApiKey
        )

        if (existingJob?.chunkIds) {
            const oldIds: string[] = JSON.parse(existingJob.chunkIds)

            await deleteMeetingVectors(oldIds, config.upstashVectorUrl, config.upstashVectorToken)
        }

        await upsertChunks(chunks, vectors, config.upstashVectorUrl, config.upstashVectorToken)

        await db
            .update(ragIndexJobs)
            .set({
                status: 'succeeded',
                chunkCount: chunks.length,
                chunkIds: JSON.stringify(chunks.map((c) => c.id)),
                error: null,
                updatedAt: new Date().toISOString(),
            })
            .where(eq(ragIndexJobs.meetingId, meetingId))
    } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error'

        await db
            .update(ragIndexJobs)
            .set({ status: 'failed', error: errorMsg, updatedAt: new Date().toISOString() })
            .where(eq(ragIndexJobs.meetingId, meetingId))
        throw err
    }
}
