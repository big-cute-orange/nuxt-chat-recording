<script setup lang="ts">
definePageMeta({ layout: false });

const { login, register, isLoading } = useAuth();

// ── Tab ───────────────────────────────────────────────────────────────────────
const tab = ref<'login' | 'register'>('login');

function switchTab(t: 'login' | 'register') {
    tab.value = t;
    formError.value = '';
    Object.assign(fields, { username: '', password: '', confirm: '' });
    Object.assign(touched, { username: false, password: false, confirm: false });
}

// ── Form state ────────────────────────────────────────────────────────────────
const fields = reactive({ username: '', password: '', confirm: '' });
const touched = reactive({ username: false, password: false, confirm: false });
const formError = ref('');
const showPassword = ref(false);
const showConfirm = ref(false);

// ── Validation ────────────────────────────────────────────────────────────────
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

const errors = computed(() => ({
    username: touched.username && !USERNAME_RE.test(fields.username) ? '3-20 位字母、数字或下划线' : '',
    password: touched.password && fields.password.length < 8 ? '至少 8 位' : '',
    confirm: tab.value === 'register' && touched.confirm && fields.confirm !== fields.password ? '两次密码不一致' : '',
}));

const isValid = computed(() => {
    const base = USERNAME_RE.test(fields.username) && fields.password.length >= 8;
    if (tab.value === 'register') return base && fields.confirm === fields.password;
    return base;
});

// ── Submit ────────────────────────────────────────────────────────────────────
async function handleSubmit() {
    // Mark all as touched to show any remaining errors
    touched.username = true;
    touched.password = true;
    if (tab.value === 'register') touched.confirm = true;

    if (!isValid.value) return;

    formError.value = '';

    try {
        if (tab.value === 'login') {
            await login(fields.username, fields.password);
        } else {
            await register(fields.username, fields.password, fields.confirm);
        }
    } catch (err: unknown) {
        formError.value =
            (err as { data?: { message?: string } })?.data?.message || (tab.value === 'login' ? '用户名或密码错误' : '注册失败，请重试');
    }
}
</script>

<template>
    <div class="page">
        <!-- Minimal nav -->
        <header class="nav">
            <div class="nav-inner">
                <NuxtLink to="/" class="back-link">← 返回对话页</NuxtLink>
                <NuxtLink to="/" class="brand">
                    <span class="brand-icon">◈</span>
                    <span class="brand-name">AI</span>
                </NuxtLink>
            </div>
        </header>

        <!-- Center card -->
        <main class="main">
            <div class="card">
                <!-- Tab switcher -->
                <div class="tabs">
                    <button :class="['tab', { active: tab === 'login' }]" @click="switchTab('login')">登录</button>
                    <button :class="['tab', { active: tab === 'register' }]" @click="switchTab('register')">注册</button>
                </div>

                <!-- Form -->
                <form class="form" @submit.prevent="handleSubmit">
                    <!-- Username -->
                    <div class="field">
                        <label class="label" for="username">用户名</label>
                        <input
                            id="username"
                            v-model="fields.username"
                            type="text"
                            class="input"
                            :class="{ error: errors.username }"
                            placeholder="3-20 位字母、数字或下划线"
                            autocomplete="username"
                            @blur="touched.username = true"
                        />
                        <p v-if="errors.username" class="field-error">{{ errors.username }}</p>
                    </div>

                    <!-- Password -->
                    <div class="field">
                        <label class="label" for="password">密码</label>
                        <div class="input-wrap">
                            <input
                                id="password"
                                v-model="fields.password"
                                :type="showPassword ? 'text' : 'password'"
                                class="input"
                                :class="{ error: errors.password }"
                                placeholder="至少 8 位"
                                autocomplete="current-password"
                                @blur="touched.password = true"
                            />
                            <button type="button" class="eye-btn" tabindex="-1" @click="showPassword = !showPassword">
                                {{ showPassword ? '隐藏' : '显示' }}
                            </button>
                        </div>
                        <p v-if="errors.password" class="field-error">{{ errors.password }}</p>
                    </div>

                    <!-- Confirm password (register only) -->
                    <Transition name="slide">
                        <div v-if="tab === 'register'" class="field">
                            <label class="label" for="confirm">确认密码</label>
                            <div class="input-wrap">
                                <input
                                    id="confirm"
                                    v-model="fields.confirm"
                                    :type="showConfirm ? 'text' : 'password'"
                                    class="input"
                                    :class="{ error: errors.confirm }"
                                    placeholder="再次输入密码"
                                    autocomplete="new-password"
                                    @blur="touched.confirm = true"
                                />
                                <button type="button" class="eye-btn" tabindex="-1" @click="showConfirm = !showConfirm">
                                    {{ showConfirm ? '隐藏' : '显示' }}
                                </button>
                            </div>
                            <p v-if="errors.confirm" class="field-error">{{ errors.confirm }}</p>
                        </div>
                    </Transition>

                    <!-- Global error -->
                    <p v-if="formError" class="form-error">⚠ {{ formError }}</p>

                    <!-- Submit -->
                    <button type="submit" class="submit-btn" :disabled="isLoading">
                        <span v-if="isLoading" class="spinner" />
                        <span>{{ isLoading ? '请稍候…' : tab === 'login' ? '登录' : '注册' }}</span>
                    </button>
                </form>

                <!-- Switch hint -->
                <p class="switch-hint">
                    <template v-if="tab === 'login'">
                        还没有账号？
                        <button class="link-btn" @click="switchTab('register')">去注册</button>
                    </template>
                    <template v-else>
                        已有账号？
                        <button class="link-btn" @click="switchTab('login')">去登录</button>
                    </template>
                </p>
            </div>
        </main>
    </div>
</template>

<style scoped>
/* ── Layout ── */
.page {
    min-height: 100vh;
    background: var(--bg);
    display: flex;
    flex-direction: column;
}

/* ── Nav ── */
.nav {
    height: 52px;
    background: #1a1a2e;
    display: flex;
    align-items: center;
    padding: 0 24px;
    flex-shrink: 0;
}

.nav-inner {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
}

.back-link {
    color: rgb(255 255 255 / 82%);
    text-decoration: none;
    font-size: 13px;
    font-weight: 600;
    transition:
        color 0.15s,
        opacity 0.15s;
}

.back-link:hover {
    color: #fff;
}

.brand {
    display: flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    color: #fff;
    font-weight: 700;
    font-size: 15px;
    letter-spacing: -0.3px;
}

.brand-icon {
    font-size: 18px;
    color: var(--accent-soft);
}

@media (width <= 520px) {
    .nav {
        height: auto;
        padding-top: 12px;
        padding-bottom: 12px;
    }

    .nav-inner {
        flex-direction: column;
        align-items: flex-start;
        gap: 10px;
    }
}

/* ── Main ── */
.main {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px 16px;
}

/* ── Card ── */
.card {
    width: 100%;
    max-width: 400px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 32px 28px 28px;
    box-shadow: 0 2px 16px rgb(0 0 0 / 5%);
}

/* ── Tabs ── */
.tabs {
    display: flex;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 3px;
    margin-bottom: 28px;
    background: var(--bg);
}

.tab {
    flex: 1;
    padding: 8px 0;
    border: none;
    border-radius: 7px;
    font-family: Syne, sans-serif;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition:
        background 0.15s,
        color 0.15s;
    background: transparent;
    color: var(--text-muted);
}

.tab.active {
    background: var(--accent);
    color: #fff;
}

/* ── Form ── */
.form {
    display: flex;
    flex-direction: column;
    gap: 18px;
}

.field {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.label {
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
}

.input-wrap {
    position: relative;
    display: flex;
    align-items: center;
}

.input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-card);
    color: var(--text);
    font-family: Syne, sans-serif;
    font-size: 14px;
    outline: none;
    transition:
        border-color 0.15s,
        box-shadow 0.15s;
}

.input-wrap .input {
    padding-right: 52px;
}

.input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-glow);
}

.input.error {
    border-color: var(--red);
}

.input.error:focus {
    box-shadow: 0 0 0 3px rgb(220 38 38 / 10%);
}

.eye-btn {
    position: absolute;
    right: 10px;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 11px;
    font-family: Syne, sans-serif;
    font-weight: 500;
    color: var(--text-muted);
    padding: 2px 4px;
    transition: color 0.15s;
}

.eye-btn:hover {
    color: var(--accent);
}

.field-error {
    font-size: 12px;
    color: var(--red);
    margin: 0;
}

.form-error {
    font-size: 13px;
    color: var(--red);
    background: rgb(220 38 38 / 7%);
    border: 1px solid rgb(220 38 38 / 20%);
    border-radius: 8px;
    padding: 10px 12px;
    margin: 0;
}

/* ── Submit button ── */
.submit-btn {
    margin-top: 4px;
    width: 100%;
    padding: 11px;
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 10px;
    font-family: Syne, sans-serif;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: opacity 0.15s;
}

.submit-btn:hover:not(:disabled) {
    opacity: 0.88;
}

.submit-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

/* ── Spinner ── */
.spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgb(255 255 255 / 30%);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
    flex-shrink: 0;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

/* ── Switch hint ── */
.switch-hint {
    margin-top: 20px;
    text-align: center;
    font-size: 13px;
    color: var(--text-muted);
}

.link-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-family: Syne, sans-serif;
    font-size: 13px;
    font-weight: 600;
    color: var(--accent);
    padding: 0;
    transition: opacity 0.15s;
}

.link-btn:hover {
    opacity: 0.75;
}

/* ── Confirm field slide animation ── */
.slide-enter-active,
.slide-leave-active {
    transition: all 0.2s ease;
    overflow: hidden;
}

.slide-enter-from,
.slide-leave-to {
    opacity: 0;
    max-height: 0;
}

.slide-enter-to,
.slide-leave-from {
    opacity: 1;
    max-height: 120px;
}
</style>
