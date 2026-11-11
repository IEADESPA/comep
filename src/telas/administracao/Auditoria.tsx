import { useEffect, useState } from 'react'
import { Carregando, Mensagem } from '../../componentes/Basicos'
import { listarAuditoria, type PaginaAuditoria, type RegistroAuditoria } from '../../dados/acessos'
import {
  formatarReais,
  NOME_DA_CATEGORIA,
  NOME_DO_TIPO_VALOR,
  type CategoriaContribuicao,
  type TipoValor,
} from '../../dados/configuracoes'
import { NOME_DO_PERFIL, type Perfil } from '../../dados/perfis'
import { formatarDataHora } from '../../utilitarios/formatos'

const NOME_DA_TABELA: Record<string, string> = {
  pessoas: 'Pessoas',
  perfis_acesso: 'Perfis de acesso',
  associados: 'Associados',
  titulos_pessoa: 'Títulos dos ministros',
  vinculos_igreja: 'Vínculos com igreja',
  igrejas: 'Igrejas',
  denominacoes: 'Denominações',
  titulos_ministeriais: 'Lista de títulos',
  bairros: 'Bairros',
  valores_contribuicao: 'Valores da contribuição',
}

const CAMPOS_IGNORADOS = new Set(['atualizado_em', 'criado_em', 'criado_por', 'id'])

function descreverOperacao(r: RegistroAuditoria): string {
  if (r.operacao === 'INSERT') return 'Criação'
  if (r.operacao === 'DELETE') return 'Exclusão'
  if (!r.dados_antes?.arquivado_em && r.dados_depois?.arquivado_em) return 'Arquivamento'
  return 'Alteração'
}

/** Nome legível do registro alterado: o nome (pessoa, igreja), o perfil e de quem é, o nº de registro… */
function descreverRegistro(r: RegistroAuditoria, pessoas: PaginaAuditoria['pessoas']): string {
  const dados = r.dados_depois ?? r.dados_antes ?? {}
  const pessoa = typeof dados.pessoa_id === 'string' ? pessoas[dados.pessoa_id] : undefined
  const partes: string[] = []
  if (typeof dados.nome === 'string') partes.push(dados.nome)
  if (typeof dados.perfil === 'string') partes.push(NOME_DO_PERFIL[dados.perfil as Perfil] ?? dados.perfil)
  if (typeof dados.numero_registro === 'number') partes.push(`Nº ${dados.numero_registro}`)
  if (typeof dados.categoria === 'string' && typeof dados.tipo === 'string') {
    partes.push(
      `${NOME_DA_CATEGORIA[dados.categoria as CategoriaContribuicao]} · ${NOME_DO_TIPO_VALOR[dados.tipo as TipoValor]}: ${formatarReais(Number(dados.valor))}`,
    )
  }
  if (pessoa) partes.push(r.tabela === 'perfis_acesso' ? `de ${pessoa}` : pessoa)
  if (partes.length === 0 && r.registro_id) partes.push(`registro ${r.registro_id.slice(0, 8)}`)
  return partes.join(' ')
}

function valorLegivel(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return '(vazio)'
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(valor)) return formatarDataHora(valor)
  return typeof valor === 'object' ? JSON.stringify(valor) : String(valor)
}

function camposAlterados(r: RegistroAuditoria): { campo: string; antes: string; depois: string }[] {
  const antes = r.dados_antes ?? {}
  const depois = r.dados_depois ?? {}
  const campos = new Set([...Object.keys(antes), ...Object.keys(depois)])
  return [...campos]
    .filter((c) => !CAMPOS_IGNORADOS.has(c))
    .filter((c) => JSON.stringify(antes[c] ?? null) !== JSON.stringify(depois[c] ?? null))
    .map((c) => ({ campo: c.replaceAll('_', ' '), antes: valorLegivel(antes[c]), depois: valorLegivel(depois[c]) }))
}

export function Auditoria() {
  const [tabela, setTabela] = useState('')
  const [pagina, setPagina] = useState(0)
  const [registros, setRegistros] = useState<RegistroAuditoria[]>([])
  const [nomes, setNomes] = useState<PaginaAuditoria['nomes']>({})
  const [pessoas, setPessoas] = useState<PaginaAuditoria['pessoas']>({})
  const [temMais, setTemMais] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    listarAuditoria(tabela, pagina).then((r) => {
      if (!ativo) return
      setCarregando(false)
      if (r.erro !== null) {
        setErro(r.erro)
        return
      }
      setErro(null)
      setRegistros((anteriores) => (pagina === 0 ? r.dados.registros : [...anteriores, ...r.dados.registros]))
      setNomes((anteriores) => ({ ...anteriores, ...r.dados.nomes }))
      setPessoas((anteriores) => ({ ...anteriores, ...r.dados.pessoas }))
      setTemMais(r.dados.temMais)
    })
    return () => {
      ativo = false
    }
  }, [tabela, pagina])

  return (
    <>
      <h1>Auditoria</h1>
      <p className="detalhe">
        Toda criação, alteração e arquivamento fica registrado aqui automaticamente pelo banco de dados. Este histórico
        não pode ser alterado nem apagado.
      </p>

      <label className="busca">
        Mostrar
        <select
          value={tabela}
          onChange={(e) => {
            setCarregando(true)
            setTabela(e.target.value)
            setPagina(0)
          }}
        >
          <option value="">Todas as áreas</option>
          {Object.entries(NOME_DA_TABELA).map(([valor, nome]) => (
            <option key={valor} value={valor}>
              {nome}
            </option>
          ))}
        </select>
      </label>

      <Mensagem erro={erro} />
      {carregando && registros.length === 0 ? (
        <Carregando />
      ) : registros.length === 0 ? (
        <p className="vazio">Nenhum registro.</p>
      ) : (
        <ol className="lista" aria-label="Registros da auditoria">
          {registros.map((r) => {
            const alterados = r.operacao === 'UPDATE' ? camposAlterados(r) : []
            const registro = descreverRegistro(r, pessoas)
            return (
              <li key={r.id} className="lista-item lista-item-estatico">
                <strong>
                  {descreverOperacao(r)} · {NOME_DA_TABELA[r.tabela] ?? r.tabela}
                  {registro && ` · ${registro}`}
                </strong>
                <span>
                  {formatarDataHora(r.ocorrido_em)} — {r.usuario_id ? (nomes[r.usuario_id] ?? 'usuário sem cadastro') : 'sistema'}
                </span>
                {alterados.length > 0 && (
                  <details>
                    <summary>O que mudou ({alterados.length})</summary>
                    <ul className="mudancas">
                      {alterados.map((m) => (
                        <li key={m.campo}>
                          <strong>{m.campo}:</strong> {m.antes} → {m.depois}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </li>
            )
          })}
        </ol>
      )}

      {temMais && (
        <div className="acoes">
          <button
            type="button"
            className="botao botao-secundario"
            disabled={carregando}
            onClick={() => {
              setCarregando(true)
              setPagina((p) => p + 1)
            }}
          >
            {carregando ? 'Carregando…' : 'Carregar mais'}
          </button>
        </div>
      )}
    </>
  )
}
