// Ícones das telas novas (Fase 5.5): os mesmos traços das propostas aprovadas (docs/telas-novas.md).
// Desenhados com a cor do texto em volta (currentColor), então seguem o modo claro/escuro sozinhos.

const CAMINHOS = {
  inicio: 'M3 10l9-7 9 7v10a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z',
  ministros: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1M16 3.13a4 4 0 0 1 0 7.75M22 21v-1a5 5 0 0 0-3-4.6',
  inscricoes: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1M19 8v6M22 11h-6',
  credencial: 'M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM8 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM14 10h4M14 14h4',
  igreja: 'M12 2v4M10 4h4M6 22V10l6-4 6 4v12M3 22h18M10 22v-4a2 2 0 0 1 4 0v4',
  assembleia: 'M3 22h18M6 18v-7M10 18v-7M14 18v-7M18 18v-7M12 2l8 5H4z',
  votar: 'M5 19V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v12M2 19h20M9 12l2 2 4-4',
  diretoria: 'M4 7h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zM16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16',
  comissao: 'M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2zM18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1',
  financeiro:
    'M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4',
  patrimonio: 'M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
  evento: 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM16 2v4M8 2v4M3 10h18',
  aviso: 'M3 11l18-5v12L3 14zM11.6 16.8a3 3 0 1 1-5.8-1.6',
  mensalidade: 'M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1zM8 8h8M8 12h8M8 16h5',
  perfil: 'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM3 22a9 9 0 0 1 18 0',
  pedido: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 15l2 2 4-4',
  busca: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  sino: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0',
  lua: 'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z',
  sol: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4',
  qr: 'M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h2v2h-2zM19 19h2v2h-2zM19 15h2M15 19v2',
  grade: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  config: 'M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4',
  menu: 'M4 6h16M4 12h16M4 18h16',
  cadeado: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  camera: 'M3 8h4l2-3h6l2 3h4v12H3zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  alerta: 'M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01',
  relogio: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  enviar: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  voltar: 'M15 18l-6-6 6-6',
  seta: 'M9 18l6-6-6-6',
  x: 'M18 6L6 18M6 6l12 12',
  sair: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  imprimir: 'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z',
  chave: 'M7.5 21a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11zM21 2l-9.6 9.6M15.5 7.5l3 3L22 7l-3-3',
  check: 'M20 6L9 17l-5-5',
  mais: 'M12 5v14M5 12h14',
  filtro: 'M3 5h18l-7 8v6l-4-2v-4z',
  baixo: 'M6 9l6 6 6-6',
  cima: 'M6 15l6-6 6 6',
  editar: 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z',
  // editor da credencial (Fase 5.5, parte 7)
  texto: 'M5 6V4h14v2M12 4v16M9 20h6',
  dados: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  imagem: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM20 15l-5-5L5 20',
  formas: 'M4 4h7v7H4zM17.5 4a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM7.5 13L11 20H4zM14 14h6v6h-6z',
  fundo: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
  camadas: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5',
  desfazer: 'M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  refazer: 'M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13',
  copiar: 'M9 9h11v11H9zM5 15H4V4h11v1',
  ordem: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  estrela: 'M12 3l2.7 5.6 6.2.9-4.5 4.4 1 6.1L12 17l-5.5 3 1-6.1L3 9.5l6.2-.9z',
  // as notificações e a segurança (Fase 5.5, partes 11 e 13)
  aparelho: 'M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2',
  conversa: 'M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 21l2.1-5.2A8.5 8.5 0 1 1 21 11.5z',
  digital:
    'M6.5 18.5A9.5 9.5 0 0 1 5 13a7 7 0 0 1 14 0v1M9 20.5c-.6-1.4-1-3.2-1-5.5a4 4 0 0 1 8 0c0 2 .4 3.6 1 5M12 13v2.5c0 2 .5 4 1.5 5.5M4.5 9A9 9 0 0 1 19.5 9',
  escudo: 'M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z',
  olho: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  baixar: 'M12 4v11M7 10l5 5 5-5M5 20h14',
} as const

export type NomeIcone = keyof typeof CAMINHOS

/** Cor por assunto (os ícones dos módulos): pessoas, assembleias e governo, finanças, eventos e avisos. */
export type Area = 'pessoas' | 'assembleias' | 'financas' | 'eventos'

export function Icone({ nome, tamanho = 20, traco = 2 }: { nome: NomeIcone; tamanho?: number; traco?: number }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={traco}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ flex: 'none' }}
    >
      <path d={CAMINHOS[nome]} />
    </svg>
  )
}

/** O símbolo do COMEP (provisório, o mesmo do ícone do app) na cor do texto em volta. */
export function Simbolo({ tamanho }: { tamanho: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 32 32" aria-hidden="true" focusable="false" style={{ flex: 'none' }}>
      <circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" strokeWidth="4" />
      <circle cx="16" cy="16" r="5.5" fill="currentColor" />
    </svg>
  )
}

/** O símbolo numa caixa branca (sobre o vermelho do COMEP). */
export function MarcaCaixa({ tamanho }: { tamanho: number }) {
  return (
    <span className="marca-caixa" style={{ width: tamanho, height: tamanho, borderRadius: Math.round(tamanho * 0.28) }}>
      <Simbolo tamanho={Math.round(tamanho * 0.62)} />
    </span>
  )
}

/** Ícone num quadrado com a cor do assunto. */
export function Ladrilho({ area, icone, tamanho = 42 }: { area: Area; icone: NomeIcone; tamanho?: number }) {
  return (
    <span
      className={`ladrilho area-${area}`}
      style={{ width: tamanho, height: tamanho, borderRadius: Math.round(tamanho * 0.28) }}
      aria-hidden="true"
    >
      <Icone nome={icone} tamanho={Math.round(tamanho * 0.5)} />
    </span>
  )
}
