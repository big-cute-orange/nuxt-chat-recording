// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-05-17',
  devtools: { enabled: true },
  runtimeConfig: {
    apiKey: '',
    aiBaseUrl: '',
    jwtSecret: '',
  },
  modules: ['@nuxt/ui', '@nuxt/eslint'],
  css: ['~/assets/css/main.css'],
  ui: {
    prefix: 'U',
  },
  // ========== 新增：确保 jose 等库在服务端正确打包 ==========
  nitro: {
    experimental: {
      wasm: true,
    },
  },
  vite: {
    optimizeDeps: {
      include: ['highlight.js', 'markdown-it'],
    },
  },
})
