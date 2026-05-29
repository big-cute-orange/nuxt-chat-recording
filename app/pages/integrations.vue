<script setup lang="ts">
import type { INotionConfig } from '~/types/index'

const defaults: { notion: INotionConfig } = {
    notion: { enabled: false, integrationToken: '', databaseId: '' },
}

const { config, loadConfig, saveConfig } = useIntegrations()
const saved = ref(false)
const visible = ref({ notion: false })

onMounted(async () => {
    await loadConfig()
    if (!config.value?.notion) {
        config.value = { ...config.value, notion: { ...defaults.notion } }
    }
})

async function save() {
    if (!config.value) return
    await saveConfig(config.value)
    saved.value = true
    setTimeout(() => { saved.value = false }, 2500)
}

async function reset() {
    await saveConfig(defaults)
    config.value = JSON.parse(JSON.stringify(defaults))
    saved.value = true
    setTimeout(() => { saved.value = false }, 2500)
}
</script>

<template>
    <div class="app">
        <!-- ── Header ─────────────────────────────────────────────── -->
        <header class="header">
            <div class="header-inner">
                <NuxtLink to="/" class="logo">
                    <span class="logo-icon">◈</span>
                    <span class="logo-text">AI</span>
                    <span class="logo-tag">智能会议纪要助手</span>
                </NuxtLink>
                <nav class="nav">
                    <NuxtLink to="/" class="nav-link">← 分析</NuxtLink>
                    <NuxtLink to="/dashboard" class="nav-link">数据看板</NuxtLink>
                    <span class="nav-active">集成管理</span>
                    <AuthButton />
                </nav>
            </div>
        </header>

        <!-- ── Main ───────────────────────────────────────────────── -->
        <main v-if="config" class="main">
            <div class="page-header">
                <div>
                    <h1 class="title">集成管理</h1>
                    <p class="subtitle">将行动项直接发送到你的项目管理工具</p>
                </div>
                <div class="page-actions">
                    <span v-if="config.notion?.enabled" class="enabled-badge">已启用</span>
                    <button class="save-btn" @click="save">
                        {{ saved ? '✓ 已保存！' : '保存设置' }}
                    </button>
                </div>
            </div>

            <!-- ── Notion ───────────────────────────────────────────── -->
            <div class="integration-card" :class="{ active: config.notion?.enabled }">
                <div class="int-header">
                    <div class="int-identity">
                        <span class="int-logo notion-logo">N</span>
                        <div>
                            <h2 class="int-name">Notion</h2>
                            <p class="int-desc">在 Notion 数据库中创建页面</p>
                        </div>
                    </div>
                    <label class="toggle" for="notion-toggle">
                        <input id="notion-toggle" v-model="config.notion!.enabled" type="checkbox" />
                        <span class="toggle-track"><span class="toggle-thumb" /></span>
                    </label>
                </div>

                <Transition name="expand">
                    <div v-if="config.notion?.enabled" class="int-fields">
                        <div class="field-row">
                            <div class="field">
                                <label class="field-label">
                                    集成令牌
                                    <a href="https://www.notion.so/my-integrations" target="_blank" class="field-link">创建集成 ↗</a>
                                </label>
                                <div class="secret-wrap">
                                    <input
                                        v-model="config.notion!.integrationToken"
                                        class="field-input"
                                        :type="visible.notion ? 'text' : 'password'"
                                        placeholder="secret_…"
                                    />
                                    <button class="show-btn" @click="visible.notion = !visible.notion">
                                        {{ visible.notion ? '隐藏' : '显示' }}
                                    </button>
                                </div>
                            </div>
                            <div class="field">
                                <label class="field-label">
                                    数据库 ID
                                    <span class="field-hint">从数据库 URL 中获取</span>
                                </label>
                                <input
                                    v-model="config.notion!.databaseId"
                                    class="field-input"
                                    placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                                />
                            </div>
                        </div>
                        <div class="field-help">
                            在 Notion 中打开你的数据库 → 点击
                            <strong>分享</strong>
                            → 添加你的集成。数据库 ID 是 URL 中
                            <code>?</code>
                            之前的 32 位字符串。
                        </div>
                    </div>
                </Transition>
            </div>

            <!-- Bottom save -->
            <div class="bottom-actions">
                <button class="text-btn" @click="reset">重置全部</button>
                <button class="save-btn large" @click="save">
                    {{ saved ? '✓ 已保存！' : '保存设置' }}
                </button>
            </div>
        </main>
    </div>
</template>

<style scoped>
.app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
}

/* ── Header ──────────────────────────────────────────────────── */
.header {
    border-bottom: 1px solid var(--border);
    backdrop-filter: blur(12px);
    position: sticky;
    top: 0;
    z-index: 100;
    background: rgb(10 10 15 / 85%);
}

.header-inner {
    max-width: 860px;
    margin: 0 auto;
    padding: 16px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.logo {
    display: flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
    color: var(--text);
}

.logo-icon {
    color: var(--accent);
    font-size: 20px;
}

.logo-text {
    font-size: 18px;
    font-weight: 800;
    letter-spacing: -0.5px;
}

.logo-tag {
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    color: var(--text-muted);
    border: 1px solid var(--border-bright);
    padding: 2px 7px;
    border-radius: 20px;
}

.nav {
    display: flex;
    align-items: center;
    gap: 16px;
}

.nav-link {
    font-family: Syne, sans-serif;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-muted);
    text-decoration: none;
    transition: color 0.2s;
}

.nav-link:hover {
    color: var(--text);
}

.nav-active {
    font-family: Syne, sans-serif;
    font-size: 13px;
    font-weight: 700;
    color: var(--accent);
}

/* ── Main ────────────────────────────────────────────────────── */
.main {
    flex: 1;
    max-width: 860px;
    margin: 0 auto;
    padding: 48px 24px;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
}

.title {
    font-size: 32px;
    font-weight: 800;
    letter-spacing: -1px;
    margin-bottom: 4px;
}

.subtitle {
    font-size: 14px;
    color: var(--text-muted);
    font-family: 'DM Mono', monospace;
}

.page-actions {
    display: flex;
    align-items: center;
    gap: 10px;
}

.enabled-badge {
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    color: var(--green);
    background: rgb(61 255 160 / 8%);
    border: 1px solid rgb(61 255 160 / 20%);
    padding: 3px 10px;
    border-radius: 20px;
}

/* Integration card */
.integration-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 14px;
    overflow: hidden;
    transition: border-color 0.2s;
}

.integration-card.active {
    border-color: var(--accent-soft);
}

.int-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
}

.int-identity {
    display: flex;
    align-items: center;
    gap: 14px;
}

/* Logo badges */
.int-logo {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 14px;
    flex-shrink: 0;
}

.notion-logo {
    background: rgb(255 255 255 / 8%);
    color: var(--text);
    border: 1px solid var(--border-bright);
}

.int-name {
    font-size: 15px;
    font-weight: 700;
    margin-bottom: 2px;
}

.int-desc {
    font-size: 12px;
    color: var(--text-muted);
}

/* Toggle switch */
.toggle {
    position: relative;
    display: inline-flex;
    cursor: pointer;
}

.toggle input {
    opacity: 0;
    width: 0;
    height: 0;
    position: absolute;
}

.toggle-track {
    width: 44px;
    height: 24px;
    background: var(--bg-hover);
    border: 1px solid var(--border-bright);
    border-radius: 12px;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    padding: 2px;
}

.toggle input:checked ~ .toggle-track {
    background: var(--accent-soft);
    border-color: var(--accent);
}

.toggle-thumb {
    width: 18px;
    height: 18px;
    background: var(--text-muted);
    border-radius: 50%;
    transition: all 0.2s;
}

.toggle input:checked ~ .toggle-track .toggle-thumb {
    background: white;
    transform: translateX(20px);
}

/* Integration fields */
.int-fields {
    padding: 0 24px 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    border-top: 1px solid var(--border);
    padding-top: 20px;
}

.field-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
}

@media (width <= 600px) {
    .field-row {
        grid-template-columns: 1fr;
    }
}

.field {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.field-label {
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}

.field-hint {
    font-size: 10px;
    color: var(--text-dim);
    text-transform: none;
    letter-spacing: 0;
}

.field-link {
    color: var(--accent);
    text-decoration: none;
    font-size: 10px;
    text-transform: none;
    letter-spacing: 0;
}

.field-link:hover {
    text-decoration: underline;
}

.field-input {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
    font-family: 'DM Mono', monospace;
    font-size: 12px;
    padding: 9px 12px;
    outline: none;
    transition: border-color 0.2s;
    width: 100%;
}

.field-input:focus {
    border-color: var(--accent);
}

.field-input::placeholder {
    color: var(--text-dim);
}

.field-select {
    cursor: pointer;
}

.field-short {
    max-width: 120px;
}

.secret-wrap {
    display: flex;
    gap: 6px;
}

.secret-wrap .field-input {
    flex: 1;
}

.show-btn {
    background: var(--bg-hover);
    border: 1px solid var(--border-bright);
    color: var(--text-muted);
    padding: 0 12px;
    border-radius: 8px;
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
    flex-shrink: 0;
}

.show-btn:hover {
    color: var(--text);
}

.field-help {
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1.6;
    background: var(--bg-hover);
    border-radius: 8px;
    padding: 10px 14px;
}

.field-help strong {
    color: var(--text);
}

.field-help code {
    font-family: 'DM Mono', monospace;
    background: var(--bg);
    padding: 1px 5px;
    border-radius: 4px;
}

/* Buttons */
.save-btn {
    background: var(--accent);
    border: none;
    color: white;
    padding: 10px 20px;
    border-radius: 8px;
    cursor: pointer;
    font-family: Syne, sans-serif;
    font-size: 13px;
    font-weight: 700;
    transition: all 0.2s;
}

.save-btn:hover {
    background: var(--accent-soft);
}

.save-btn.large {
    padding: 12px 28px;
    font-size: 14px;
}

.text-btn {
    background: none;
    border: 1px solid var(--border-bright);
    color: var(--text-muted);
    padding: 10px 16px;
    border-radius: 8px;
    cursor: pointer;
    font-family: Syne, sans-serif;
    font-size: 13px;
    font-weight: 600;
    transition: all 0.2s;
}

.text-btn:hover {
    color: var(--red);
    border-color: var(--red);
}

.bottom-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    align-items: center;
    padding-top: 8px;
}

/* ── Footer ──────────────────────────────────────────────────── */
.footer {
    border-top: 1px solid var(--border);
    text-align: center;
    padding: 20px;
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    color: var(--text-dim);
    letter-spacing: 0.05em;
}

/* ── Transitions ─────────────────────────────────────────────── */
.expand-enter-active,
.expand-leave-active {
    transition: opacity 0.2s ease;
}

.expand-enter-from,
.expand-leave-to {
    opacity: 0;
}
</style>
