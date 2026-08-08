import { Index } from '@upstash/vector'
import type { RagChunk } from './chunk'

export interface VectorMetadata {
    userId: string
    meetingId: string
    meetingType: string
    date: string
    contentType: string
    text: string
    // Index signature required to satisfy Upstash Vector's Dict constraint
    [key: string]: string
}

export interface QueryResult {
    id: string
    score: number
    metadata: VectorMetadata
}

function buildIndex(upstashVectorUrl: string, upstashVectorToken: string): Index<VectorMetadata> {
    return new Index<VectorMetadata>({ url: upstashVectorUrl, token: upstashVectorToken })
}

export async function upsertChunks(chunks: RagChunk[], vectors: number[][], upstashVectorUrl: string, upstashVectorToken: string): Promise<void> {
    if (chunks.length === 0) return
    const index = buildIndex(upstashVectorUrl, upstashVectorToken)

    const records = chunks.map((chunk, i) => ({
        id: chunk.id,
        vector: vectors[i]!,
        metadata: { ...chunk.metadata, text: chunk.text },
    }))

    await index.upsert(records)
}

export async function queryVectors(
    queryVector: number[],
    userId: string,
    opts: { meetingId?: string; dateRange?: 'all' | '7d' | '30d' },
    upstashVectorUrl: string,
    upstashVectorToken: string
): Promise<QueryResult[]> {
    const index = buildIndex(upstashVectorUrl, upstashVectorToken)

    let filter = `userId = '${userId}'`

    if (opts.meetingId) {
        filter += ` AND meetingId = '${opts.meetingId}'`
    }

    if (opts.dateRange && opts.dateRange !== 'all') {
        const days = opts.dateRange === '7d' ? 7 : 30
        const cutoff = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)

        filter += ` AND date >= '${cutoff}'`
    }

    const results = await index.query<VectorMetadata>({
        vector: queryVector,
        topK: 8,
        includeMetadata: true,
        filter,
    })

    return results
        .filter((r) => r.metadata != null)
        .map((r) => ({
            id: String(r.id),
            score: r.score,
            metadata: r.metadata as VectorMetadata,
        }))
}

export async function deleteMeetingVectors(chunkIds: string[], upstashVectorUrl: string, upstashVectorToken: string): Promise<void> {
    if (chunkIds.length === 0) return
    const index = buildIndex(upstashVectorUrl, upstashVectorToken)

    await index.delete(chunkIds)
}
