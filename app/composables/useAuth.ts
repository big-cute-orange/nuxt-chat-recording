interface ISessionUser {
    id: string
    username: string | null
    name: string | null
    email: string | null
    avatarUrl: string | null
    provider: string
    providerAccountId: string
    createdAt: string
    updatedAt: string
}

export const useAuth = () => {
    const { loggedIn, user: sessionUser, fetch: fetchUserSession } = useUserSession()
    const isLoading = ref(false)
    const error = ref('')

    // nuxt-auth-utils hydrates the session during SSR, so it's always ready
    const isReady = computed(() => true)
    const user = computed(() => (sessionUser.value as ISessionUser | undefined) ?? null)
    const fetchSession = () => fetchUserSession()

    const login = async (username: string, password: string) => {
        isLoading.value = true
        error.value = ''
        try {
            await $fetch('/api/auth/login', { method: 'POST', body: { username, password } })
            await fetchUserSession()
            await navigateTo('/')
        } catch (err: unknown) {
            throw err
        } finally {
            isLoading.value = false
        }
    }

    const register = async (username: string, password: string, confirmPassword: string) => {
        isLoading.value = true
        error.value = ''
        try {
            await $fetch('/api/auth/register', { method: 'POST', body: { username, password, confirmPassword } })
            await fetchUserSession()
            await navigateTo('/')
        } catch (err: unknown) {
            throw err
        } finally {
            isLoading.value = false
        }
    }

    const logout = async () => {
        isLoading.value = true
        error.value = ''
        try {
            await $fetch('/api/auth/logout', { method: 'POST' })
            await fetchUserSession()
            await navigateTo('/')
        } catch {
            error.value = '退出失败'
        } finally {
            isLoading.value = false
        }
    }

    return {
        user,
        loggedIn,
        isLoading: readonly(isLoading),
        isReady,
        error: readonly(error),
        login,
        register,
        logout,
        fetchSession,
    }
}
