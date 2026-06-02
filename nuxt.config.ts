// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    compatibilityDate: '2026-05-20',

    app: {
        head: {
            link: [
                { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
                // Preconnect to Google Fonts domains so the font request starts
                // as early as possible — eliminates the flash of unstyled text
                { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
                { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
                {
                    rel: 'stylesheet',
                    href: 'https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&display=swap',
                },
            ],
        },
    },

    // Nuxt 4 uses the app/ directory by default
    future: {
        compatibilityVersion: 4,
    },

    css: ['~/assets/css/main.css'],

    modules: ['@nuxtjs/tailwindcss', 'nuxt-auth-utils'],

    devtools: { enabled: true },

    runtimeConfig: {
        // Server-side only — never exposed to the client
        openaiApiKey: process.env.OPENAI_API_KEY || '',
        deepseekApiKey: process.env.DEEPSEEK_API_KEY || '',
        qwenApiKey: process.env.QWEN_API_KEY || '',
        dobaoApiKey: process.env.DOBAO_API_KEY || '',
        dobaoModelId: process.env.DOBAO_MODEL_ID || '',

        // Turso (LibSQL) — falls back to a local SQLite file in development
        tursoDbUrl: process.env.TURSO_DB_URL || '',
        tursoAuthToken: process.env.TURSO_AUTH_TOKEN || '',

        // Upstash Vector — for RAG meeting history Q&A
        upstashVectorUrl: process.env.UPSTASH_VECTOR_REST_URL || '',
        upstashVectorToken: process.env.UPSTASH_VECTOR_REST_TOKEN || '',

        // nuxt-auth-utils session secret (min 32 chars)
        // Set NUXT_SESSION_PASSWORD in .env for production
        session: {
            password: process.env.NUXT_SESSION_PASSWORD || 'dev-secret-must-be-32-characters-long',
        },

        // Public runtime config (safe to expose to client)
        public: {
            siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000',
        },
    },

    // Nitro server configuration
    nitro: {
        prerender: {
            crawlLinks: false,
        },
    },
})
