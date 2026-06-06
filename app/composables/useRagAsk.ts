import type { TProvider } from '~/types'

export interface Citation {
    meetingId: string
    meetingType: string
    date: string
    contentType: string
    excerpt: string
    score: number
}

export function useRagAsk() {
    const question = ref('')
    const answer = ref('')
    const citations = ref<Citation[]>([])
    const loading = ref(false)
    const error = ref<string | null>(null)
    const scope = ref<'all' | 'current'>('all')
    const dateRange = ref<'all' | '7d' | '30d'>('all')
    const provider = ref<TProvider>('qwen')

    async function ask(activeMeetingId?: string) {
        if (!question.value.trim() || loading.value) return

        loading.value = true
        error.value = null
        answer.value = ''
        citations.value = []

        try {
            const response = await fetch('/api/rag/ask', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: question.value,
                    scope: scope.value,
                    meetingId: scope.value === 'current' ? activeMeetingId : undefined,
                    dateRange: dateRange.value,
                    provider: provider.value,
                }),
            })

            if (!response.ok) {
                const err = await response.json()

                throw new Error(err.message || '请求失败')
            }

            const reader = response.body!.getReader()
            const decoder = new TextDecoder()
            let buffer = ''

            while (true) {
                const { done, value } = await reader.read()

                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n\n')

                buffer = lines.pop() || ''

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue

                    try {
                        const data = JSON.parse(line.slice(6))

                        if (data.error) throw new Error(data.error)

                        if (data.chunk) answer.value += data.chunk

                        if (data.done) {
                            citations.value = data.citations ?? []
                        }
                    } catch (parseErr: unknown) {
                        if (parseErr instanceof Error && !parseErr.message.includes('JSON')) {
                            throw parseErr
                        }
                    }
                }
            }
        } catch (err: unknown) {
            error.value = (err as Error)?.message || '出现了未知错误'
        } finally {
            loading.value = false
        }
    }

    function reset() {
        question.value = ''
        answer.value = ''
        citations.value = []
        error.value = null
    }

    return { question, answer, citations, loading, error, scope, dateRange, provider, ask, reset }
}
