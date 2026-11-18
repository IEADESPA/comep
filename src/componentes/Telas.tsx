import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router'
import { Icone, type Area } from './Icone'

// Peças das telas novas (Fase 5.5, docs/telas-novas.md): o cabeçalho da tela, as abas (cada aba é um submódulo, com
// endereço próprio: o link abre na aba certa), o selo da secretaria e as etiquetas por assunto.

/** Título da tela, com a frase embaixo. No celular, a seta "voltar" ao lado leva ao Início. */
export function CabecalhoTela({ titulo, sub, visivel = true }: { titulo: ReactNode; sub?: ReactNode; visivel?: boolean }) {
  // a tela começa num cartão com o nome (ex.: Meu perfil): o título fica só para o leitor de tela
  if (!visivel) return <h1 className="somente-leitor">{titulo}</h1>
  return (
    <div className="cabecalho-nova">
      <div className="titulo-com-voltar">
        <Link to="/painel" className="voltar-celular so-celular" aria-label="Voltar para o Início">
          <Icone nome="voltar" tamanho={24} traco={2.4} />
        </Link>
        <h1>{titulo}</h1>
      </div>
      {sub && <p className="sub-tela">{sub}</p>}
    </div>
  )
}

export type Aba = { para: string; nome: string; curto?: string }

/** As abas da tela (submódulos). Cada uma é um link com endereço próprio. */
export function AbasDaTela({ rotulo, abas }: { rotulo: string; abas: readonly Aba[] }) {
  return (
    <nav className="abas-tela" aria-label={rotulo}>
      {abas.map((a, i) => (
        <NavLink
          key={a.para}
          to={a.para}
          end={i === 0}
          className={({ isActive }) => (isActive ? 'aba-tela ativa' : 'aba-tela')}
          aria-label={a.curto ? a.nome : undefined}
        >
          {a.curto ? (
            <>
              <span className="so-computador" aria-hidden="true">
                {a.nome}
              </span>
              <span className="so-celular" aria-hidden="true">
                {a.curto}
              </span>
            </>
          ) : (
            a.nome
          )}
        </NavLink>
      ))}
    </nav>
  )
}

export type TipoSelo = 'aprovado' | 'analise' | 'recusado'

const SELO: Record<TipoSelo, { area: Area; icone: 'check' | 'relogio' | 'x' }> = {
  aprovado: { area: 'financas', icone: 'check' },
  analise: { area: 'eventos', icone: 'relogio' },
  recusado: { area: 'pessoas', icone: 'x' },
}

/** O selo da secretaria: aprovado, em análise ou recusado. */
export function Selo({ tipo, children }: { tipo: TipoSelo; children: ReactNode }) {
  const s = SELO[tipo]
  return (
    <span className={`selo-novo area-${s.area}`}>
      <Icone nome={s.icone} tamanho={15} traco={2.6} />
      {children}
    </span>
  )
}

/** Etiqueta redonda com a cor do assunto (em dia = finanças/verde; em atraso = pessoas/vermelho…). */
export function Chip({ area, children }: { area: Area; children: ReactNode }) {
  return <span className={`chip area-${area}`}>{children}</span>
}

/** A foto 3×4 da pessoa, ou as iniciais quando não há foto. */
export function FotoOuIniciais({ foto, nome, largura }: { foto: string | null; nome: string; largura: number }) {
  const altura = Math.round((largura * 4) / 3)
  if (foto) return <img className="foto-3x4" src={foto} alt="Sua foto" width={largura} height={altura} />
  const partes = nome.trim().split(/\s+/)
  const iniciais = ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase()
  return (
    <span className="foto-3x4 foto-iniciais" role="img" aria-label="Sem foto" style={{ width: largura, height: altura, fontSize: Math.round(largura * 0.32) }}>
      {iniciais}
    </span>
  )
}
