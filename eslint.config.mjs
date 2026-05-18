// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    rules: {
      'no-var': 'error',
      'vue/html-self-closing': 'off',
    },
  }
)
