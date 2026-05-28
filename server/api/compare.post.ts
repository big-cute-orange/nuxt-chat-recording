import OpenAI from 'openai'
import { defineEventHandler, readBody, createError, type H3Event } from 'h3'
import { MeetingSummarySchema } from '~~/shared/schemas/meeting'
import { version as promptVersion, transcriptPrompt } from '../prompts/index'
import { aiLogs } from '../db/schema'

const SYSTEM_PROMPT = transcriptPrompt

type TProvider = 'deepseek' | 'qwen' | 'doubao'

function buildClient(provider: TProvider, config: Record<string, string>): { client: OpenAI; model: string } {
    switch (provider) {
        case 'deepseek':
            if (!config.deepseekApiKey) throw new Error('DeepSeek API key not configured.')
            return {
                client: new OpenAI({ apiKey: config.deepseekApiKey, baseURL: 'https://api.deepseek.com/v1' }),
                model: 'deepseek-chat',
            }
        case 'qwen':
            if (!config.qwenApiKey) throw new Error('Qwen API key not configured.')
            return {
                client: new OpenAI({ apiKey: config.qwenApiKey, baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1' }),
                model: 'qwen-plus',
            }
        case 'doubao':
            if (!config.dobaoApiKey) throw new Error('Doubao API key not configured.')
            if (!config.dobaoModelId) throw new Error('Doubao model endpoint ID (DOBAO_MODEL_ID) not configured.')
            return {
                client: new OpenAI({ apiKey: config.dobaoApiKey, baseURL: 'https://ark.cn-beijing.volces.com/api/v3', timeout: 120_000 }),
                model: config.dobaoModelId,
            }
    }
}

async function callProvider(provider: TProvider, text: string, config: Record<string, string>): Promise<string> {
    const { client, model } = buildClient(provider, config)
    const userMessage = `Please analyze this meeting transcript:\n\n${text}`

    const response = await client.chat.completions.create({
        model,
        max_tokens: 2048,
        messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userMessage },
        ],
    })

    return response.choices[0]?.message.content ?? ''
}

// function parseResult(raw: string) {
//     const cleaned = raw
//         .replace(/```json\n?/g, '')
//         .replace(/```\n?/g, '')
//         .trim();

//     return JSON.parse(cleaned);
// }
function parseResult(raw: string) {
    const cleaned = raw
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim()
    const result = MeetingSummarySchema.safeParse(JSON.parse(cleaned))
    if (!result.success) {
        console.warn('[AI] Schema validation failed:', result.error.flatten())
        return null
    }
    return result.data
}

export default defineEventHandler(async (event: H3Event) => {
    const config = useRuntimeConfig()
    const body = await readBody(event)
    const { text, providers } = body

    if (!text || text.trim().length < 10) {
        throw createError({ statusCode: 400, message: 'Transcript is too short.' })
    }

    if (!Array.isArray(providers) || providers.length !== 2) {
        throw createError({ statusCode: 400, message: 'Exactly 2 providers required.' })
    }

    const [resultA, resultB] = await Promise.allSettled([
        callProvider(providers[0], text, config as unknown as Record<string, string>),
        callProvider(providers[1], text, config as unknown as Record<string, string>),
    ])

    const parseSettled = async (settled: PromiseSettledResult<string>, provider: string) => {
        if (settled.status === 'rejected') {
            return { error: settled.reason?.message ?? 'Failed' }
        }

        try {
            const result = parseResult(settled.value)
            const cleaned = settled.value
                .replace(/```json\n?/g, '')
                .replace(/```\n?/g, '')
                .trim()
            const parsed = MeetingSummarySchema.safeParse(JSON.parse(cleaned))
            await useDb()
                .insert(aiLogs)
                .values({
                    id: crypto.randomUUID(),
                    provider,
                    promptVersion,
                    rawOutput: settled.value,
                    validationPassed: parsed.success,
                    validationErrors: parsed.success ? null : JSON.stringify(parsed.error.flatten()),
                    createdAt: new Date().toISOString(),
                })
                .catch(() => {
                    /* 日志写失败不影响主流程 */
                })
            return result
        } catch {
            return { error: 'Failed to parse response as JSON.' }
        }
    }

    return {
        a: { provider: providers[0], result: await parseSettled(resultA, providers[0]) },
        b: { provider: providers[1], result: await parseSettled(resultB, providers[1]) },
    }
})
