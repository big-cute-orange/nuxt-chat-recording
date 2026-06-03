// POST /api/rag/ask
// Streams an answer to a question based on the user's meeting history.

import { defineEventHandler, readBody, setResponseHeaders, createError, type H3Event } from 'h3'
import { streamAnswer } from '#server/services/rag/answer'
import type { TProvider } from '#server/utils/ai'

export default defineEventHandler(async (event: H3Event) => {
    const config = useRuntimeConfig()

    if (!config.upstashVectorUrl || !config.upstashVectorToken) {
        throw createError({ statusCode: 503, message: 'RAG service not configured.' })
    }

    if (!config.qwenApiKey) {
        throw createError({ statusCode: 503, message: 'Qwen API key not configured.' })
    }

    const session = await getUserSession(event)
    const userId = session?.user?.id

    if (!userId) {
        throw createError({ statusCode: 401, message: 'Login required.' })
    }

    const body = await readBody(event)
    const { question, scope = 'all', meetingId, dateRange = 'all', provider } = body

    if (!question || String(question).trim().length < 2) {
        throw createError({ statusCode: 400, message: 'Question is too short.' })
    }

    setResponseHeaders(event, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
    })

    const stream = event.node.res

    const answerStream = streamAnswer(
        String(question),
        userId,
        {
            scope: scope === 'current' ? 'current' : 'all',
            meetingId: meetingId ? String(meetingId) : undefined,
            dateRange: ['7d', '30d'].includes(dateRange) ? (dateRange as '7d' | '30d') : 'all',
            provider: provider as TProvider | undefined,
        },
        {
            qwenApiKey: config.qwenApiKey,
            upstashVectorUrl: config.upstashVectorUrl,
            upstashVectorToken: config.upstashVectorToken,
            deepseekApiKey: config.deepseekApiKey,
            dobaoApiKey: config.dobaoApiKey,
            dobaoModelId: config.dobaoModelId,
        }
    )

    try {
        for await (const event of answerStream) {
            stream.write(`data: ${JSON.stringify(event)}\n\n`)
        }
    } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error'

        stream.write(`data: ${JSON.stringify({ error: errorMsg })}\n\n`)
    } finally {
        stream.end()
    }
})
