import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Gera os ícones do app (favicon, Android, iPhone) a partir de public/logo.svg
// durante o build. Quando a identidade visual for aprovada, basta trocar o logo.svg.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: minimal2023Preset,
  images: ['public/logo.svg'],
})
