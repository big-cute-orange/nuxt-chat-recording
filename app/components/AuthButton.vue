<script setup lang="ts">
const { user, logout } = useAuth();

const open = ref(false);
const menuRef = ref<HTMLElement | null>(null);

const displayName = computed(() => user.value?.username || user.value?.name || user.value?.email || '?');
const initial = computed(() => displayName.value[0]?.toUpperCase() ?? '?');

function toggle() {
    open.value = !open.value;
}

function handleLogout() {
    open.value = false;
    logout();
}

function onClickOutside(e: MouseEvent) {
    if (menuRef.value && !menuRef.value.contains(e.target as Node)) {
        open.value = false;
    }
}

onMounted(() => document.addEventListener('mousedown', onClickOutside));
onUnmounted(() => document.removeEventListener('mousedown', onClickOutside));
</script>

<template>
    <div class="auth-button">
        <template v-if="user">
            <div ref="menuRef" class="user-wrap">
                <Transition name="menu">
                    <div v-if="open" class="user-menu-card">
                        <button class="menu-item logout" @click="handleLogout">
                            <span class="menu-item-icon">
                                <svg
                                    width="15"
                                    height="15"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                >
                                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                    <polyline points="16 17 21 12 16 7" />
                                    <line x1="21" y1="12" x2="9" y2="12" />
                                </svg>
                            </span>
                            退出登录
                        </button>
                    </div>
                </Transition>

                <button class="avatar-btn" :class="{ active: open }" @click="toggle">
                    <span class="avatar-initial">{{ initial }}</span>
                    <span class="avatar-name">{{ displayName }}</span>
                    <span class="avatar-chevron">▾</span>
                </button>
            </div>
        </template>

        <template v-else>
            <NuxtLink to="/login" class="signin-btn">登录 / 注册</NuxtLink>
        </template>
    </div>
</template>

<style scoped>
.auth-button {
    display: inline-flex;
    align-items: center;
}

/* ── Avatar trigger ───────────────────────────────── */
.user-wrap {
    position: relative;
}

.avatar-btn {
    height: 38px;
    padding: 0 10px 0 6px;
    border-radius: 20px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    color: var(--text);
    font-size: 13px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 7px;
    transition:
        border-color 0.15s,
        box-shadow 0.15s;
    flex-shrink: 0;
    white-space: nowrap;
}

.avatar-btn:hover,
.avatar-btn.active {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-glow);
}

.avatar-initial {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--accent) 0%, var(--accent-soft) 100%);
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.avatar-name {
    max-width: 100px;
    overflow: hidden;
    text-overflow: ellipsis;
}

.avatar-chevron {
    font-size: 10px;
    color: var(--text-muted);
    transition: transform 0.15s;
}

.avatar-btn.active .avatar-chevron {
    transform: rotate(180deg);
}

/* ── Popup card ───────────────────────────────────── */
.user-menu-card {
    position: absolute;
    top: calc(100% + 10px);
    left: 0;
    width: 240px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 14px;
    box-shadow: 0 8px 32px rgb(0 0 0 / 18%);
    overflow: hidden;
    z-index: 300;
}

.menu-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 14px 16px;
    background: none;
    border: none;
    font-size: 14px;
    font-family: inherit;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s;
    color: var(--text);
}

.menu-item:hover {
    background: var(--bg-hover);
}

.menu-item.logout {
    color: var(--red, #e05252);
}

.menu-item-icon {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    opacity: 0.75;
}

/* ── Transition ───────────────────────────────────── */
.menu-enter-active,
.menu-leave-active {
    transition:
        opacity 0.15s ease,
        transform 0.15s ease;
}

.menu-enter-from,
.menu-leave-to {
    opacity: 0;
    transform: translateY(-6px) scale(0.97);
}

/* ── Login button ─────────────────────────────────── */
.signin-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 38px;
    padding: 0 14px;
    background: var(--accent);
    color: #fff;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    font-family: inherit;
    white-space: nowrap;
    text-decoration: none;
    transition: opacity 0.15s;
}

.signin-btn:hover {
    opacity: 0.85;
}
</style>
