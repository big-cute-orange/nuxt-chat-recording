import type { TProvider } from '#server/utils/ai'
import { buildProviderConfig } from '#server/utils/ai'
import { embedTexts } from './embedding'
import { queryVectors, type QueryResult } from './vector'
import { buildRagPrompt } from './prompt'

export interface Citation {
    meetingId: string
    meetingType: string
    date: string
    contentType: string
    excerpt: string
    score: number
}

interface AnswerConfig {
    qwenApiKey: string
    upstashVectorUrl: string
    upstashVectorToken: string
    [key: string]: string
}

export async function* streamAnswer(
    question: string,
    userId: string,
    opts: { scope: 'all' | 'current'; meetingId?: string; dateRange?: 'all' | '7d' | '30d'; provider?: TProvider },
    config: AnswerConfig
): AsyncGenerator<{ chunk?: string; done?: boolean; citations?: Citation[]; error?: string }> {
    const provider: TProvider = opts.provider || 'qwen'

    try {
        const [queryVec] = await embedTexts([question], config.qwenApiKey)

        if (!queryVec) {
            yield { error: '生成问题向量失败。' }

            return
        }

        const results: QueryResult[] = await queryVectors(
            queryVec,
            userId,
            { meetingId: opts.scope === 'current' ? opts.meetingId : undefined, dateRange: opts.dateRange },
            config.upstashVectorUrl,
            config.upstashVectorToken
        )

        if (results.length === 0) {
            yield { chunk: '在已保存的会议记录中未找到相关信息。' }
            yield { done: true, citations: [] }

            return
        }

        const contexts = results
            .map((r, i) => `[${i + 1}] (${r.metadata.date} · ${r.metadata.meetingType})\n${r.metadata.text}`)
            .join('\n\n')

        const prompt = buildRagPrompt(contexts, question)
        const { client, model } = buildProviderConfig(provider, config)

        const stream = await client.chat.completions.create({
            model,
            max_tokens: 1024,
            temperature: 0.3,
            messages: [{ role: 'user', content: prompt }],
            stream: true,
        })

        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content || ''

            if (delta) yield { chunk: delta }
        }

        // Deduplicate by meetingId, keep highest-score chunk per meeting, limit to 4
        const seen = new Map<string, Citation>()

        for (const r of results) {
            if (r.score < 0.4) continue
            const existing = seen.get(r.metadata.meetingId)

            if (!existing || r.score > existing.score) {
                seen.set(r.metadata.meetingId, {
                    meetingId: r.metadata.meetingId,
                    meetingType: r.metadata.meetingType,
                    date: r.metadata.date,
                    contentType: r.metadata.contentType,
                    excerpt: r.metadata.text.slice(0, 120),
                    score: r.score,
                })
            }
        }

        const citations = [...seen.values()]
            .sort((a, b) => b.score - a.score)
            .slice(0, 4)

        yield { done: true, citations }
    } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error'

        yield { error: errorMsg }
    }
}
