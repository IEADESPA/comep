import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
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
