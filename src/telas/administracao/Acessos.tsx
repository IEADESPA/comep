import { useState } from 'react'
import { Link } from 'react-router'
import { Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { GerarCodigo } from '../../componentes/GerarCodigo'
import { concederPerfil, listarPessoasComPerfis, retirarPerfil, type PessoaComPerfis } from '../../dados/acessos'
import { NOME_DO_PERFIL, PERFIS, type Perfil } from '../../dados/perfis'
import { useCarregar } from '../../estado/useCarregar'
import { contemTexto, formatarData } from '../../utilitarios/formatos'

// Perfis automáticos, que acompanham o cadastro de associado (tela Ministros): não são concedidos nem retirados aqui.
//   ministro          = associado ativo
//   presidente_igreja = associado ativo marcado como pastor presidente da igreja
const PERFIS_AUTOMATICOS: readonly Perfil[] = ['ministro', 'presidente_igreja']
const PERFIS_CONCEDIVEIS = PERFIS.filter((p) => !PERFIS_AUTOMATICOS.includes(p))

/** Quantas pessoas a lista desenha de uma vez (o resto se acha pela busca). */
const MAXIMO_NA_TELA = 50

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
        Só a presidência concede e retira perfis. Secretaria, tesouraria e presidência só podem ser dados a{' '}
        <strong>associados ativos</strong>: como qualquer pessoa pode criar login pelo site, um login sem cadastro de
        associado ainda não foi conferido. Os perfis <strong>Ministro</strong> e <strong>Presidente de igreja</strong>{' '}
        vêm automaticamente do cadastro de associado (o presidente de igreja é o pastor presidente marcado na ficha). Retirar
        um perfil não apaga nada: fica registrado na auditoria.
      </p>
      <p className="detalhe">
        Os cargos da <Link to="/diretoria">Diretoria e Conselho Fiscal</Link> também dão o perfil, enquanto o mandato vale
        (eles não aparecem nesta lista: o acesso começa na posse e termina sozinho no fim do mandato).
      </p>
      <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />

      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(pessoas) => {
          // Com mais de mil pessoas (18/11/2026), desenhar todas deixava a tela lenta: sem busca, aparecem só as que
          // têm algum perfil; com busca, as primeiras que batem.
          const termo = busca.trim()
          const filtradas = termo
            ? pessoas.filter((p) => contemTexto(p.nome, termo) || contemTexto(p.email, termo))
            : pessoas.filter((p) => p.perfis_acesso.length > 0)
          const mostradas = filtradas.slice(0, MAXIMO_NA_TELA)
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
              <p className="detalhe">
                {!termo
                  ? `Sem busca, aparecem as pessoas que já têm algum perfil (${filtradas.length}). Para conceder um perfil a outra pessoa, busque pelo nome ou pelo e-mail.`
                  : filtradas.length > MAXIMO_NA_TELA
                    ? `Mostrando ${MAXIMO_NA_TELA} de ${filtradas.length}: escreva mais do nome para achar a pessoa.`
                    : `${filtradas.length} ${filtradas.length === 1 ? 'pessoa encontrada' : 'pessoas encontradas'}.`}
              </p>
              <ul className="lista" aria-label="Pessoas">
                {mostradas.map((pessoa) => (
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
  const associado = pessoa.associados.find((a) => a.situacao === 'ativo')
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
      <span>
        {associado ? (
          <span className="etiqueta etiqueta-marca">Associado nº {associado.numero_registro}</span>
        ) : (
          <span className="etiqueta">Não é associado: login criado pelo site em {formatarData(pessoa.criado_em)}</span>
        )}
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
