interface ISessionUser {
    id: string;
    username: string | null;
    name: string | null;
    email: string | null;
    avatarUrl: string | null;
    provider: string;
    providerAccountId: string;
    createdAt: string;
    updatedAt: string;
}

interface IAuthSession {
    user?: ISessionUser;
}

export const useAuth = () => {
    const user = useState<ISessionUser | null>('auth.user', () => null);
    const isLoading = useState<boolean>('auth.isLoading', () => false);
    const error = useState<string>('auth.error', () => '');

    const fetchSession = async () => {
        try {
            const session = await $fetch<IAuthSession>('/api/auth/session');
            user.value = session?.user || null;
            error.value = '';
            return session?.user || null;
        } catch {
            user.value = null;
            return null;
        }
    };

    const login = async (username: string, password: string) => {
        isLoading.value = true;
        error.value = '';
        try {
            await $fetch('/api/auth/login', {
                method: 'POST',
                body: { username, password },
            });
            await fetchSession();
            await navigateTo('/');
        } catch (err: unknown) {
            // Don't set global error.value here — let the caller display it
            // to avoid stale error strings persisting across navigation
            throw err;
        } finally {
            isLoading.value = false;
        }
    };

    const register = async (username: string, password: string, confirmPassword: string) => {
        isLoading.value = true;
        error.value = '';
        try {
            await $fetch('/api/auth/register', {
                method: 'POST',
                body: { username, password, confirmPassword },
            });
            await fetchSession();
            await navigateTo('/');
        } catch (err: unknown) {
            // Don't set global error.value here — let the caller display it
            throw err;
        } finally {
            isLoading.value = false;
        }
    };

    const logout = async () => {
        isLoading.value = true;
        error.value = '';
        try {
            await $fetch('/api/auth/logout', { method: 'POST' });
            user.value = null;
            await navigateTo('/');
        } catch {
            error.value = '退出失败';
        } finally {
            isLoading.value = false;
        }
    };

    if (process.client) {
        onMounted(() => {
            fetchSession();
        });
    }

    return {
        user: readonly(user),
        isLoading: readonly(isLoading),
        error: readonly(error),
        login,
        register,
        logout,
        fetchSession,
    };
};
