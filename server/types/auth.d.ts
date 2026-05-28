declare module '#auth-utils' {
    interface User {
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
}

export {}
