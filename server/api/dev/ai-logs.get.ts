import { defineEventHandler, createError } from 'h3'
import { desc } from 'drizzle-orm'
import { aiLogs } from '../../db/schema'

export default defineEventHandler(async (event) => {
    if (process.env.NODE_ENV === 'production') {
        throw createError({ statusCode: 403, message: 'Forbidden' })
    }

    const db = useDb()
    const logs = await db.select().from(aiLogs).orderBy(desc(aiLogs.createdAt)).limit(200)

    const total = logs.length
    const passed = logs.filter((l) => l.validationPassed).length
    const byProvider = logs.reduce<Record<string, { total: number; passed: number }>>((acc, l) => {
        if (!acc[l.provider]) acc[l.provider] = { total: 0, passed: 0 }
        acc[l.provider].total++
        if (l.validationPassed) acc[l.provider].passed++
        return acc
    }, {})
    const byVersion = logs.reduce<Record<string, { total: number; passed: number }>>((acc, l) => {
        if (!acc[l.promptVersion]) acc[l.promptVersion] = { total: 0, passed: 0 }
        acc[l.promptVersion].total++
        if (l.validationPassed) acc[l.promptVersion].passed++
        return acc
    }, {})

    return {
        summary: { total, passed, failed: total - passed, passRate: total ? `${((passed / total) * 100).toFixed(1)}%` : 'N/A' },
        byProvider,
        byVersion,
        logs: logs.map((l) => ({
            id: l.id,
            provider: l.provider,
            promptVersion: l.promptVersion,
            validationPassed: l.validationPassed,
            validationErrors: l.validationErrors ? JSON.parse(l.validationErrors) : null,
            createdAt: l.createdAt,
        })),
    }
})
