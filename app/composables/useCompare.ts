import type { TProvider, IMeetingSummary, ICompareResult, ICompareResponse } from '~/types'

export type { ICompareResult, ICompareResponse }

export interface IJudgeScores {
    completeness: number
    accuracy: number
    actionability: number
    conciseness: number
    overall: number
}

export interface IJudgeResponse {
    winner: 'model_a' | 'model_b' | 'tie'
    scores: {
        model_a: IJudgeScores
        model_b: IJudgeScores
    }
    reason: string
    judgeProvider: TProvider
}

export function isCompareError(r: IMeetingSummary | { error: string }): r is { error: string } {
    return 'error' in r
}

export function useCompare() {
    const results = ref<ICompareResponse | null>(null)
    const loading = ref(false)
    const error = ref<string | null>(null)

    const judgeResult = ref<IJudgeResponse | null>(null)
    const judgeLoading = ref(false)

    async function compare(text: string, providers: [TProvider, TProvider]) {
        loading.value = true
        error.value = null
        results.value = null
        judgeResult.value = null

        try {
            const response = await fetch('/api/compare', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, providers }),
            })

            if (!response.ok) {
                const err = await response.json()

                throw new Error(err.message || 'Request failed.')
            }

            results.value = await response.json()

            // Trigger judge asynchronously after results are shown
            if (results.value) {
                const r = results.value
                const outputA = !isCompareError(r.a.result) ? JSON.stringify(r.a.result) : null
                const outputB = !isCompareError(r.b.result) ? JSON.stringify(r.b.result) : null

                if (outputA && outputB) {
                    runJudge(text, outputA, outputB, providers[0], providers[1])
                }
            }
        } catch (err: unknown) {
            error.value = (err as Error).message || 'Something went wrong.'
        } finally {
            loading.value = false
        }
    }

    async function runJudge(
        transcript: string,
        outputA: string,
        outputB: string,
        providerA: TProvider,
        providerB: TProvider
    ) {
        judgeLoading.value = true
        try {
            const response = await fetch('/api/judge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transcript, outputA, outputB, providerA, providerB }),
            })

            if (!response.ok) return

            const data = await response.json()

            judgeResult.value = data ?? null
        } catch {
            // silently skip
        } finally {
            judgeLoading.value = false
        }
    }

    function reset() {
        results.value = null
        error.value = null
        judgeResult.value = null
        judgeLoading.value = false
    }

    return { compare, results, loading, error, judgeResult, judgeLoading, reset, isError: isCompareError }
}
