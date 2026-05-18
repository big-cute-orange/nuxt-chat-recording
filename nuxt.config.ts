// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-05-17',
  devtools: { enabled: true },
  runtimeConfig: {
    apiKey: '',
    aiBaseUrl: '',
  },
  modules: ['@nuxt/ui', '@nuxt/eslint'],
  css: ['~/assets/css/main.css'],
  ui: {
    prefix: 'U',
  },
})
