// GET /api/history
// Returns a paginated list of meeting history entries.
// Filtered by userId from session when auth is active (nullable in anonymous mode).

import { defineEventHandler, getQuery, type H3Event } from 'h3'
import { desc, eq, sql, inArray } from 'drizzle-orm'
import { useDb } from '#server/utils/db'
import { meetings, ragIndexJobs } from '#server/db/schema'
import type { IHistoryEntry } from '~/types'

export default defineEventHandler(async (event: H3Event) => {
    const db = useDb()
    const query = getQuery(event)
    const page = Math.max(1, Number(query.page) || 1)
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20))
    const offset = (page - 1) * limit

    // Anonymous users do not have server-side history.
    const session = await getUserSession(event)
    const userId = session?.user?.id

    if (!userId) {
        return { data: [], total: 0, page, limit }
    }

    const [rows, countRows] = await Promise.all([
        db.select().from(meetings).where(eq(meetings.userId, userId)).orderBy(desc(meetings.createdAt)).limit(limit).offset(offset),
        db
            .select({ count: sql<number>`COUNT(*)` })
            .from(meetings)
            .where(eq(meetings.userId, userId)),
    ])

    const total = countRows[0]?.count ?? 0

    // Fetch RAG index statuses for this page of meetings
    const meetingIds = rows.map((r) => r.id)
    const ragStatusMap: Record<string, string> = {}

    if (meetingIds.length > 0) {
        const ragRows = await db
            .select({ meetingId: ragIndexJobs.meetingId, status: ragIndexJobs.status })
            .from(ragIndexJobs)
            .where(inArray(ragIndexJobs.meetingId, meetingIds))

        for (const r of ragRows) {
            ragStatusMap[r.meetingId] = r.status
        }
    }

    const data: (IHistoryEntry & { indexStatus?: string })[] = rows
        .map((row: (typeof rows)[number]) => {
            let summary

            try {
                summary = JSON.parse(row.summary)
            } catch {
                return null
            }

            return {
                id: row.id,
                date: row.date,
                meetingType: row.meetingType,
                provider: row.provider as IHistoryEntry['provider'],
                charCount: row.charCount,
                transcript: row.transcript,
                summary,
                mode: row.mode as IHistoryEntry['mode'],
                indexStatus: ragStatusMap[row.id] ?? null,
            }
        })
        .filter((entry): entry is IHistoryEntry & { indexStatus?: string } => entry !== null)

    return { data, total, page, limit }
})
