import { useState } from 'react'
import { Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { GerarCodigo } from '../../componentes/GerarCodigo'
import { concederPerfil, listarPessoasComPerfis, retirarPerfil, type PessoaComPerfis } from '../../dados/acessos'
import { NOME_DO_PERFIL, PERFIS, type Perfil } from '../../dados/perfis'
import { useCarregar } from '../../estado/useCarregar'
import { contemTexto } from '../../utilitarios/formatos'

// Perfis automáticos, que acompanham o cadastro de associado (tela Ministros): não são concedidos nem retirados aqui.
//   ministro          = associado ativo
//   presidente_igreja = associado ativo marcado como pastor presidente da igreja
const PERFIS_AUTOMATICOS: readonly Perfil[] = ['ministro', 'presidente_igreja']
const PERFIS_CONCEDIVEIS = PERFIS.filter((p) => !PERFIS_AUTOMATICOS.includes(p))

type Retorno = { sucesso?: string; erro?: string }

export function Acessos() {
  const [carga, recarregar] = useCarregar(listarPessoasComPerfis)
  const [busca, setBusca] = useState('')
  const [retorno, setRetorno] = useState<Retorno>({})

  function concluir(r: { erro: string | null }, sucesso: string) {
    setRetorno(r.erro ? { erro: r.erro } : { sucesso })
    if (!r.erro) recarregar()
  }

  return (
    <>
      <h1>Perfis de acesso</h1>
      <p className="detalhe">
        Só a presidência concede e retira perfis. Os perfis <strong>Ministro</strong> e <strong>Presidente de igreja</strong>{' '}
        vêm automaticamente do cadastro de associado (o presidente de igreja é o pastor presidente marcado na ficha). Retirar
        um perfil não apaga nada: fica registrado na auditoria.
      </p>
      <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />

      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(pessoas) => {
          const filtradas = pessoas.filter((p) => contemTexto(p.nome, busca) || contemTexto(p.email, busca))
          return (
            <>
              <label className="busca">
                Buscar pessoa
                <input
                  type="search"
                  placeholder="Nome ou e-mail"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </label>
              <ul className="lista" aria-label="Pessoas">
                {filtradas.map((pessoa) => (
                  <LinhaPessoa key={pessoa.id} pessoa={pessoa} concluir={concluir} />
                ))}
              </ul>
              {filtradas.length === 0 && <p className="vazio">Ninguém encontrado.</p>}
            </>
          )
        }}
      </MostrarCarga>
    </>
  )
}

function LinhaPessoa({
  pessoa,
  concluir,
}: {
  pessoa: PessoaComPerfis
  concluir: (r: { erro: string | null }, sucesso: string) => void
}) {
  const [novo, setNovo] = useState<Perfil | ''>('')
  const [enviando, setEnviando] = useState(false)
  const tem = new Set(pessoa.perfis_acesso.map((p) => p.perfil))
  const opcoes = PERFIS_CONCEDIVEIS.filter((p) => !tem.has(p))

  async function conceder() {
    if (!novo) return
    setEnviando(true)
    const r = await concederPerfil(pessoa.id, novo)
    setEnviando(false)
    concluir(r, `Perfil ${NOME_DO_PERFIL[novo]} concedido a ${pessoa.nome}.`)
    setNovo('')
  }

  async function retirar(id: string, perfil: Perfil) {
    setEnviando(true)
    const r = await retirarPerfil(id)
    setEnviando(false)
    concluir(r, `Perfil ${NOME_DO_PERFIL[perfil]} retirado de ${pessoa.nome}.`)
  }

  return (
    <li className="lista-item lista-item-estatico" aria-label={pessoa.nome}>
      <strong>{pessoa.nome}</strong>
      <span>
        {pessoa.email ?? 'Sem e-mail'}
        {!pessoa.usuario_id && <span className="etiqueta etiqueta-neutra">Sem login</span>}
      </span>
      <ul className="perfis perfis-compacto" aria-label={`Perfis de ${pessoa.nome}`}>
        {pessoa.perfis_acesso.length === 0 && <li className="sem-perfil">Nenhum perfil</li>}
        {pessoa.perfis_acesso.map((p) => (
          <li key={p.id}>
            {NOME_DO_PERFIL[p.perfil]}
            {!PERFIS_AUTOMATICOS.includes(p.perfil) && (
              <button
                type="button"
                className="chip-remover"
                aria-label={`Retirar o perfil ${NOME_DO_PERFIL[p.perfil]} de ${pessoa.nome}`}
                disabled={enviando}
                onClick={() => void retirar(p.id, p.perfil)}
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
      {opcoes.length > 0 && (
        <form
          className="form-linha form-compacto"
          onSubmit={(e) => {
            e.preventDefault()
            void conceder()
          }}
        >
          <label>
            <span className="somente-leitor">Perfil para conceder a {pessoa.nome}</span>
            <select value={novo} onChange={(e) => setNovo(e.target.value as Perfil | '')}>
              <option value="">Conceder perfil…</option>
              {opcoes.map((p) => (
                <option key={p} value={p}>
                  {NOME_DO_PERFIL[p]}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="botao botao-secundario" disabled={!novo || enviando}>
            Conceder
          </button>
        </form>
      )}
      <details className="acao-recolhida">
        <summary>Código de acesso</summary>
        <GerarCodigo pessoaId={pessoa.id} nome={pessoa.nome} temLogin={Boolean(pessoa.usuario_id)} />
      </details>
    </li>
  )
}
