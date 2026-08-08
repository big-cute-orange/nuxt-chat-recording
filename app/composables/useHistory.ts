import type { IHistoryEntry, IHistoryPage, IMeetingSummary, ICompareResponse } from '~/types'

const LEGACY_KEY = 'minutai:history'
const LOCAL_LIMIT = 100

export function useHistory() {
    const { user, isReady, fetchSession, loggedIn } = useAuth()
    const history = ref<IHistoryEntry[]>([])
    const total = ref(0)
    const page = ref(1)
    const limit = ref(20)
    const loading = ref(false)
    const error = ref<string | null>(null)
    const isLoggedIn = computed(() => Boolean(user.value?.id))

    watch(loggedIn, (val) => {
        if (!val) {
            history.value = []
            total.value = 0
            page.value = 1
            load(1)
        }
    })

    async function ensureAuthReady() {
        if (!isReady.value) {
            await fetchSession()
        }
    }

    function readLocalHistory(): IHistoryEntry[] {
        if (typeof localStorage === 'undefined') {
            return []
        }

        try {
            const raw = localStorage.getItem(LEGACY_KEY)

            if (!raw) {
                return []
            }

            const entries = JSON.parse(raw) as IHistoryEntry[]

            return Array.isArray(entries) ? entries : []
        } catch {
            return []
        }
    }

    function writeLocalHistory(entries: IHistoryEntry[]) {
        if (typeof localStorage === 'undefined') {
            return
        }

        // eslint-disable-next-line no-restricted-properties -- Stores anonymous meeting history, not tokens.
        localStorage.setItem(LEGACY_KEY, JSON.stringify(entries.slice(0, LOCAL_LIMIT)))
    }

    // ── Fetch ─────────────────────────────────────────────────────────────────
    async function load(p = 1) {
        await ensureAuthReady()

        if (!isLoggedIn.value) {
            const entries = readLocalHistory()

            history.value = entries
            total.value = entries.length
            page.value = 1
            error.value = null

            return
        }

        loading.value = true
        error.value = null

        try {
            const data = await $fetch<IHistoryPage>('/api/history', { query: { page: p, limit: limit.value } })

            history.value = data.data
            total.value = data.total
            page.value = data.page
        } catch (err: unknown) {
            error.value = (err as Error)?.message ?? 'Failed to load history.'
        } finally {
            loading.value = false
        }
    }

    async function loadMore() {
        await ensureAuthReady()

        if (!isLoggedIn.value) {
            return
        }

        if (history.value.length >= total.value) {
            return
        }

        loading.value = true

        try {
            const nextPage = page.value + 1
            const data = await $fetch<IHistoryPage>('/api/history', {
                query: {
                    page: nextPage,
                    limit: limit.value,
                },
            })

            history.value = [...history.value, ...data.data]
            total.value = data.total
            page.value = data.page
        } catch (err: unknown) {
            error.value = (err as Error)?.message ?? 'Failed to load more history.'
        } finally {
            loading.value = false
        }
    }

    // ── Mutations ─────────────────────────────────────────────────────────────
    async function add(
        summary: IMeetingSummary | ICompareResponse,
        transcript: string,
        provider: IHistoryEntry['provider'],
        mode: 'single' | 'compare' = 'single'
    ): Promise<string> {
        await ensureAuthReady()

        const meetingType =
            mode === 'compare'
                ? (('a' in summary && !('error' in summary.a.result) ? (summary.a.result as IMeetingSummary).meetingType : null) ?? '对比分析')
                : (summary as IMeetingSummary).meetingType

        if (!isLoggedIn.value) {
            const entry: IHistoryEntry = {
                id: crypto.randomUUID(),
                date: new Date().toISOString(),
                meetingType,
                provider,
                charCount: transcript.length,
                transcript,
                summary,
                mode,
            }

            const entries = [entry, ...readLocalHistory()]

            writeLocalHistory(entries)
            history.value = entries.slice(0, LOCAL_LIMIT)
            total.value = history.value.length
            page.value = 1

            return entry.id
        }

        const entry = await $fetch<IHistoryEntry>('/api/history', {
            method: 'POST',
            body: { summary, transcript, provider, mode },
        })

        history.value.unshift(entry)
        total.value++

        return entry.id
    }

    async function update(id: string, summary: IMeetingSummary) {
        await ensureAuthReady()

        if (!isLoggedIn.value) {
            const entries = readLocalHistory()
            const idx = entries.findIndex((e) => e.id === id)

            if (idx === -1) {
                return
            }

            entries[idx] = {
                ...entries[idx]!,
                summary,
                meetingType: summary.meetingType,
            }
            writeLocalHistory(entries)
            history.value = entries
            total.value = entries.length

            return
        }

        await $fetch(`/api/history/${id}`, {
            method: 'PATCH',
            body: { summary },
        })

        const idx = history.value.findIndex((e) => e.id === id)

        if (idx !== -1) {
            history.value[idx] = {
                ...history.value[idx],
                summary,
                meetingType: summary.meetingType,
            } as IHistoryEntry
        }
    }

    async function remove(id: string) {
        await ensureAuthReady()

        if (!isLoggedIn.value) {
            const entries = readLocalHistory().filter((e) => e.id !== id)

            writeLocalHistory(entries)
            history.value = entries
            total.value = entries.length

            return
        }

        await $fetch(`/api/history/${id}`, { method: 'DELETE' })
        history.value = history.value.filter((e) => e.id !== id)
        total.value = Math.max(0, total.value - 1)
    }

    async function clear() {
        await ensureAuthReady()

        if (!isLoggedIn.value) {
            writeLocalHistory([])
            history.value = []
            total.value = 0

            return
        }

        const ids = history.value.map((e) => e.id)

        await Promise.all(ids.map((id) => $fetch(`/api/history/${id}`, { method: 'DELETE' })))
        history.value = []
        total.value = 0
    }

    // ── One-time localStorage migration ───────────────────────────────────────
    // Runs on first load if legacy data exists in localStorage.
    // Removes the localStorage key after a successful migration.
    async function migrateFromLocalStorage() {
        if (typeof localStorage === 'undefined') {
            return
        }

        await ensureAuthReady()

        if (!isLoggedIn.value) {
            return
        }

        const raw = localStorage.getItem(LEGACY_KEY)

        if (!raw) {
            return
        }

        try {
            const entries: IHistoryEntry[] = JSON.parse(raw)

            if (!entries.length) {
                localStorage.removeItem(LEGACY_KEY)

                return
            }

            await $fetch('/api/history/bulk', {
                method: 'POST',
                body: { entries },
            })

            localStorage.removeItem(LEGACY_KEY)
            await load(1)

            // eslint-disable-next-line no-console
            console.info('[useHistory] Migrated', entries.length, 'entries from localStorage.')
        } catch (err) {
            console.warn('[useHistory] localStorage migration failed:', err)
        }
    }

    const hasMore = computed(() => history.value.length < total.value)

    return {
        history,
        total,
        page,
        limit,
        loading,
        error,
        hasMore,
        load,
        loadMore,
        add,
        update,
        remove,
        clear,
        migrateFromLocalStorage,
    }
}
