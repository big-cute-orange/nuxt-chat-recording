import { defineEventHandler, readBody, setResponseHeaders, createError, type H3Event } from 'h3'
import { version as promptVersion, transcriptPrompt, freeNotesPrompt } from '../prompts/index'
import { MeetingSummarySchema } from '~~/shared/schemas/meeting'
import { aiLogs } from '../db/schema'
import { buildProviderConfig, type TProvider } from '../utils/ai'

export default defineEventHandler(async (event: H3Event) => {
    const config = useRuntimeConfig()
    const body = await readBody(event)
    const { text, provider, inputType } = body
    const SYSTEM_PROMPT = inputType === 'free-notes' ? freeNotesPrompt : transcriptPrompt

    if (!text || text.trim().length < 10) {
        throw createError({ statusCode: 400, message: 'Text is too short.' })
    }

    if (!['deepseek', 'qwen', 'doubao'].includes(provider)) {
        throw createError({ statusCode: 400, message: 'Invalid provider.' })
    }

    const { client, model, apiKeyName } = buildProviderConfig(provider as TProvider, config as unknown as Record<string, string>)

    if (!client.apiKey) {
        throw createError({ statusCode: 400, message: `${apiKeyName} is not configured.` })
    }

    if (provider === 'doubao' && !model) {
        throw createError({ statusCode: 400, message: 'Doubao model endpoint ID (DOUBAO_MODEL_ID) is not configured.' })
    }

    setResponseHeaders(event, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
    })

    const stream = event.node.res
    const userMessage =
        inputType === 'free-notes'
            ? `Please structure these raw meeting notes:\n\n${text}`
            : `Please analyze this meeting transcript:\n\n${text}`

    try {
        let fullText = ''

        const response = await client.chat.completions.create({
            model,
            max_tokens: 2048,
            temperature: 0.2,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: userMessage },
            ],
            stream: true,
        })

        for await (const chunk of response) {
            const delta = chunk.choices[0]?.delta?.content || ''

            if (delta) {
                fullText += delta
                stream.write(`data: ${JSON.stringify({ chunk: delta })}\n\n`)
            }
        }

        // 在所有 chunk 接收完后统一发送 done，不依赖 finish_reason 的具体值
        // 避免不同 provider 返回不同 finish_reason 导致前端永远等待
        stream.write(`data: ${JSON.stringify({ done: true, full: fullText })}\n\n`)

        // 异步写日志，不阻塞响应
        const cleaned = fullText
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim()

        try {
            let validationPassed = false
            let validationErrors: string | null = null

            try {
                const parsed = MeetingSummarySchema.safeParse(JSON.parse(cleaned))

                validationPassed = parsed.success
                validationErrors = parsed.success ? null : JSON.stringify(parsed.error.flatten())
            } catch {
                validationErrors = JSON.stringify({ message: 'Invalid JSON returned by AI' })
            }

            await useDb()
                .insert(aiLogs)
                .values({
                    id: crypto.randomUUID(),
                    provider,
                    promptVersion,
                    rawOutput: fullText,
                    validationPassed,
                    validationErrors,
                    createdAt: new Date().toISOString(),
                })
        } catch {
            /* 日志写失败不影响主流程 */
        }
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.'

        stream.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`)
    } finally {
        stream.end()
    }
})
