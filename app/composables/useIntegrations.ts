import type { IMeetingSummary, IIntegrationsConfig } from '~/types'

export type TIntegrationId = 'notion'

export interface ISendResult {
    task: string
    url: string | null
    error: string | null
}

export interface ISendStatus {
    loading: boolean
    results: ISendResult[]
    error: string | null
}

const LEGACY_KEY = 'minutai:integrations'

export function useIntegrations() {
    const config = ref<Partial<IIntegrationsConfig> | null>(null)

    async function loadConfig() {
        try {
            const serverConfig = await $fetch<Partial<IIntegrationsConfig>>('/api/integrations/config')

            if (!serverConfig || Object.keys(serverConfig).length === 0) {
                const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LEGACY_KEY) : null

                if (raw) {
                    const legacyConfig: Partial<IIntegrationsConfig> = JSON.parse(raw)

                    await $fetch('/api/integrations/config', {
                        method: 'PUT',
                        body: legacyConfig,
                    })

                    localStorage.removeItem(LEGACY_KEY)
                    config.value = legacyConfig

                    return
                }
            }

            config.value = serverConfig
        } catch {
            try {
                const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LEGACY_KEY) : null

                config.value = raw ? JSON.parse(raw) : null
            } catch {
                config.value = null
            }
        }
    }

    async function saveConfig(newConfig: Partial<IIntegrationsConfig>) {
        config.value = newConfig

        await $fetch('/api/integrations/config', {
            method: 'PUT',
            body: newConfig,
        })
    }

    const enabledIntegrations = computed<TIntegrationId[]>(() => {
        if (!config.value) return []

        const enabled: TIntegrationId[] = []

        if (config.value.notion?.enabled && config.value.notion.integrationToken && config.value.notion.databaseId) {
            enabled.push('notion')
        }

        return enabled
    })

    const hasIntegrations = computed(() => enabledIntegrations.value.length > 0)

    const status = ref<Record<TIntegrationId, ISendStatus>>({
        notion: { loading: false, results: [], error: null },
    })

    function resetStatus(id: TIntegrationId) {
        status.value[id] = { loading: false, results: [], error: null }
    }

    async function sendTo(id: TIntegrationId, summary: IMeetingSummary, meetingId: string | null) {
        if (!config.value) return

        status.value[id] = { loading: true, results: [], error: null }

        try {
            const payload: Record<string, unknown> = {
                actionItems: summary.actionItems,
                meetingType: summary.meetingType,
                meetingId,
                ...config.value.notion,
            }

            const res = await fetch(`/api/integrations/${id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            const data = await res.json()

            if (!res.ok) {
                status.value[id] = { loading: false, results: [], error: data.message ?? `HTTP ${res.status}` }
            } else {
                status.value[id] = { loading: false, results: data.results, error: null }
            }
        } catch (err: unknown) {
            status.value[id] = { loading: false, results: [], error: (err as Error).message }
        }
    }

    async function loadSentItems(meetingId: string) {
        resetStatus('notion')
        try {
            const items = await $fetch<Array<{ title: string; externalUrl: string | null; externalService: string | null }>>(
                `/api/action-items?meetingId=${meetingId}`
            )
            const notionItems = items.filter((i) => i.externalService === 'notion')
            if (notionItems.length) {
                status.value.notion.results = notionItems.map((i) => ({ task: i.title, url: i.externalUrl, error: null }))
            }
        } catch {
            // ignore
        }
    }

    const integrationMeta: Record<TIntegrationId, { label: string; logo: string; logoClass: string }> = {
        notion: { label: 'Notion', logo: 'N', logoClass: 'notion-logo' },
    }

    onMounted(() => loadConfig())

    return {
        config,
        enabledIntegrations,
        hasIntegrations,
        status,
        sendTo,
        resetStatus,
        loadSentItems,
        integrationMeta,
        loadConfig,
        saveConfig,
    }
}
