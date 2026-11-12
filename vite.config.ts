import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Caminho onde o app é publicado. No GitHub Pages da IEADESPA: https://ieadespa.github.io/comep/
// Numa migração futura (domínio próprio do Conselho), basta definir VITE_BASE=/ no build.
const base = process.env.VITE_BASE ?? '/comep/'
// O ambiente de teste é publicado junto, em /comep/teste/, ligado ao banco de teste (PROJETO.md, seção 14.3)
const ehTeste = process.env.VITE_AMBIENTE === 'teste'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      pwaAssets: { config: true, overrideManifestIcons: true },
      manifest: {
        name: ehTeste ? 'COMEP — Sistema de Gestão (teste)' : 'COMEP — Sistema de Gestão',
        short_name: ehTeste ? 'COMEP teste' : 'COMEP',
        description: 'Sistema de Gestão do Conselho de Ministros Evangélicos de Parauapebas',
        lang: 'pt-BR',
        theme_color: '#b91c1c',
        background_color: '#ffffff',
        display: 'standalone',
        // O app instalado no celular abre direto no Portal do membro
        start_url: `${base}painel`,
        scope: base,
      },
      workbox: {
        // Guarda só os arquivos do app (telas, estilos, ícones) para abrir com internet ruim.
        // Respostas do banco (dados pessoais) NÃO são guardadas no aparelho.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        // O app instalado do site oficial não responde pelos endereços do ambiente de teste
        navigateFallbackDenylist: [new RegExp(`^${base}teste/`)],
      },
    }),
  ],
})
