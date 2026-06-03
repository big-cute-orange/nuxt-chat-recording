import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import type { IMeetingSummary } from '~~/shared/schemas/meeting'

export interface RagChunk {
    id: string
    text: string
    metadata: {
        userId: string
        meetingId: string
        meetingType: string
        date: string
        contentType: 'summary' | 'action_item' | 'decision' | 'transcript'
    }
}

function safeMeetingUserId(userId: string | null | undefined): string {
    return userId || 'anonymous'
}

export async function buildChunks(
    meetingId: string,
    userId: string | null | undefined,
    date: string,
    meetingType: string,
    summary: IMeetingSummary,
    transcript: string
): Promise<RagChunk[]> {
    const safeUserId = safeMeetingUserId(userId)
    const chunks: RagChunk[] = []

    // Summary overview block
    if (summary.summary) {
        const topicsText = summary.keyTopics.length ? `\n关键议题：${summary.keyTopics.join('、')}` : ''
        const participantsText = summary.participants.length ? `\n参与者：${summary.participants.join('、')}` : ''

        chunks.push({
            id: `${meetingId}:summary:0`,
            text: `会议概要：${summary.summary}${topicsText}${participantsText}`,
            metadata: { userId: safeUserId, meetingId, meetingType, date, contentType: 'summary' },
        })
    }

    // Action items — one chunk each
    summary.actionItems.forEach((item, i) => {
        const text = `行动项：${item.task}，负责人：${item.owner}，截止：${item.deadline}，优先级：${item.priority}`

        chunks.push({
            id: `${meetingId}:action_item:${i}`,
            text,
            metadata: { userId: safeUserId, meetingId, meetingType, date, contentType: 'action_item' },
        })
    })

    // Decisions — one chunk each
    summary.decisions.forEach((d, i) => {
        const text = `决策：${d.decision}，理由：${d.rationale}，决策人：${d.madeBy}`

        chunks.push({
            id: `${meetingId}:decision:${i}`,
            text,
            metadata: { userId: safeUserId, meetingId, meetingType, date, contentType: 'decision' },
        })
    })

    // Transcript — chunked by character count, not token count
    if (transcript && transcript.trim().length > 0) {
        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 700,
            chunkOverlap: 100,
            lengthFunction: (t: string) => t.length,
        })
        const transcriptChunks = await splitter.splitText(transcript)

        transcriptChunks.forEach((text, i) => {
            chunks.push({
                id: `${meetingId}:transcript:${i}`,
                text,
                metadata: { userId: safeUserId, meetingId, meetingType, date, contentType: 'transcript' },
            })
        })
    }

    return chunks
}
