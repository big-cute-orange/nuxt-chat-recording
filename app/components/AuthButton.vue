<script setup lang="ts">
const { user, logout } = useAuth();

const displayName = computed(() => user.value?.username || user.value?.name || user.value?.email || '?');
const initial = computed(() => displayName.value[0]?.toUpperCase() ?? '?');
</script>

<template>
    <div class="auth-button">
        <!-- Authenticated -->
        <template v-if="user">
            <div class="user-menu">
                <div class="avatar">{{ initial }}</div>
                <span class="name">{{ displayName }}</span>
                <button class="logout-btn" @click="logout">退出</button>
            </div>
        </template>

        <!-- Not authenticated -->
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

/* ── Authenticated state ── */
.user-menu {
    display: flex;
    align-items: center;
    gap: 10px;
}

.avatar {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--accent) 0%, var(--accent-soft) 100%);
    color: #fff;
    font-size: 13px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.name {
    font-size: 13px;
    font-weight: 500;
    color: #fff;
    opacity: 0.9;
}

.logout-btn {
    padding: 5px 11px;
    background: rgb(255 255 255 / 12%);
    color: #fff;
    border: 1px solid rgb(255 255 255 / 20%);
    border-radius: 6px;
    font-size: 12px;
    font-family: Syne, sans-serif;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
}

.logout-btn:hover {
    background: rgb(255 255 255 / 20%);
}

/* ── Not authenticated state ── */
.signin-btn {
    padding: 7px 16px;
    background: var(--accent);
    color: #fff;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    font-family: Syne, sans-serif;
    text-decoration: none;
    transition: opacity 0.15s;
}

.signin-btn:hover {
    opacity: 0.85;
}
</style>
