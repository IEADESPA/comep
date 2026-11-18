import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Letras das telas novas (Fase 5.5), guardadas no próprio app (sem buscar em servidor de fora):
// Inter no texto e Plus Jakarta Sans nos títulos, só o alfabeto latino (português)
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-700.css'
import '@fontsource/inter/latin-800.css'
import '@fontsource/plus-jakarta-sans/latin-700.css'
import '@fontsource/plus-jakarta-sans/latin-800.css'
import App from './App'
import './estilos.css'

// Link direto do ambiente de teste (/comep/teste/...) no GitHub Pages: o 404.html do site oficial
// redireciona para /comep/teste/?rota=...; aqui o endereço volta a ser o original, sem recarregar.
const rota = new URLSearchParams(window.location.search).get('rota')
if (rota !== null) {
  window.history.replaceState(null, '', import.meta.env.BASE_URL + rota.replace(/^\/+/, ''))
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
