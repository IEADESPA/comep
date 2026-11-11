import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { Aviso, BotaoConfirmar, Mensagem, MostrarCarga } from '../../componentes/Basicos'
import {
  arquivarIgreja,
  buscarIgreja,
  listarDenominacoes,
  ministrosDaIgreja,
  salvarIgreja,
  type DadosIgreja,
  type Denominacao,
  type Igreja,
} from '../../dados/cadastros'
import { ok } from '../../dados/cliente'
import { listarItens, type ItemLista } from '../../dados/configuracoes'
import { useCarregar } from '../../estado/useCarregar'
import { cnpjValido, formatarCnpj, limparCnpj } from '../../utilitarios/formatos'

/** /igrejas/nova */
export function NovaIgreja() {
  return <FormIgreja key="nova" />
}

/** /igrejas/:id — remonta a tela ao trocar de igreja */
export function EditarIgreja() {
  const { id } = useParams()
  return <FormIgreja key={id} id={id} />
}

type DadosTela = { denominacoes: Denominacao[]; bairros: ItemLista[]; igreja: Igreja | null }

function FormIgreja({ id }: { id?: string }) {
  const [carga, recarregar] = useCarregar(async () => {
    const [denominacoes, bairros, igreja] = await Promise.all([
      listarDenominacoes(),
      listarItens('bairros'),
      id ? buscarIgreja(id) : ok(null),
    ])
    if (denominacoes.erro !== null) return denominacoes
    if (bairros.erro !== null) return bairros
    if (igreja.erro !== null) return igreja
    return ok<DadosTela>({ denominacoes: denominacoes.dados, bairros: bairros.dados, igreja: igreja.dados })
  })

  return (
    <MostrarCarga carga={carga} recarregar={recarregar}>
      {({ denominacoes, bairros, igreja }) =>
        id && !igreja ? (
          <Aviso titulo="Igreja não encontrada">
            <p>Ela pode ter sido arquivada.</p>
            <p>
              <Link to="/igrejas">Voltar para a lista de igrejas</Link>
            </p>
          </Aviso>
        ) : (
          <Formulario id={id} igreja={igreja} denominacoes={denominacoes} bairros={bairros} />
        )
      }
    </MostrarCarga>
  )
}

type PropsFormulario = { id?: string; igreja: Igreja | null; denominacoes: Denominacao[]; bairros: ItemLista[] }

function Formulario({ id, igreja, denominacoes, bairros }: PropsFormulario) {
  const navigate = useNavigate()
  const location = useLocation()
  const mensagemAnterior = (location.state as { mensagem?: string } | null)?.mensagem
  const [dados, setDados] = useState<DadosIgreja>({
    nome: igreja?.nome ?? '',
    denominacao_id: igreja?.denominacao_id ?? '',
    cnpj: formatarCnpj(igreja?.cnpj),
    endereco: igreja?.endereco ?? '',
    bairro_id: igreja?.bairro_id ?? '',
    telefone: igreja?.telefone ?? '',
    presidente_nome: igreja?.presidente_nome ?? '',
  })
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<{ sucesso?: string; erro?: string }>({ sucesso: mensagemAnterior })

  const campo = (nome: keyof DadosIgreja) => ({
    value: dados[nome] ?? '',
    onChange: (e: { target: { value: string } }) => setDados((d) => ({ ...d, [nome]: e.target.value })),
  })

  async function salvar() {
    const cnpj = dados.cnpj ? limparCnpj(dados.cnpj) : ''
    if (cnpj && !cnpjValido(cnpj)) {
      setResultado({ erro: 'CNPJ inválido. Confira os números (ou deixe em branco se não souber).' })
      return
    }
    setEnviando(true)
    const r = await salvarIgreja({ ...dados, cnpj }, id)
    setEnviando(false)
    if (r.erro !== null) {
      setResultado({ erro: r.erro })
      return
    }
    if (!id) {
      navigate(`/igrejas/${r.dados}`, { replace: true, state: { mensagem: 'Igreja cadastrada.' } })
      return
    }
    setResultado({ sucesso: 'Alterações salvas.' })
  }

  async function arquivar() {
    if (!id) return
    const r = await arquivarIgreja(id)
    if (r.erro !== null) {
      setResultado({ erro: r.erro })
      return
    }
    navigate('/igrejas', { replace: true, state: { mensagem: `Igreja "${dados.nome}" arquivada.` } })
  }

  return (
    <>
      <p className="trilha">
        <Link to="/igrejas">← Igrejas</Link>
      </p>
      <h1>{id ? igreja?.nome : 'Nova igreja'}</h1>

      <form
        className="painel"
        onSubmit={(e) => {
          e.preventDefault()
          void salvar()
        }}
      >
        <div className="grade-form">
          <label className="largura-total">
            Nome da igreja *
            <input required {...campo('nome')} />
          </label>
          <label>
            Denominação
            <select {...campo('denominacao_id')}>
              <option value="">— Não informada —</option>
              {denominacoes.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.sigla ? `${d.nome} (${d.sigla})` : d.nome}
                </option>
              ))}
              {/* Item arquivado em Configurações continua aparecendo para a igreja que já o usa */}
              {igreja?.denominacao_id && !denominacoes.some((d) => d.id === igreja.denominacao_id) && (
                <option value={igreja.denominacao_id}>{igreja.denominacao?.nome} (arquivada)</option>
              )}
            </select>
          </label>
          <label>
            CNPJ
            <input inputMode="text" autoCapitalize="characters" placeholder="00.000.000/0000-00" {...campo('cnpj')} />
          </label>
          <label className="largura-total">
            Endereço
            <input {...campo('endereco')} />
          </label>
          <label>
            Bairro
            <select {...campo('bairro_id')}>
              <option value="">— Não informado —</option>
              {bairros.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nome}
                </option>
              ))}
              {igreja?.bairro_id && !bairros.some((b) => b.id === igreja.bairro_id) && (
                <option value={igreja.bairro_id}>{igreja.bairro?.nome} (arquivado)</option>
              )}
            </select>
          </label>
          <label>
            Telefone
            <input type="tel" {...campo('telefone')} />
          </label>
          <label className="largura-total">
            Pastor presidente
            <input {...campo('presidente_nome')} />
          </label>
        </div>
        <p className="detalhe">
          Não achou a denominação ou o bairro? Cadastre em <Link to="/configuracoes">Configurações</Link>.
        </p>
        <Mensagem sucesso={resultado.sucesso} erro={resultado.erro} />
        <div className="acoes">
          <button type="submit" className="botao" disabled={enviando}>
            {enviando ? 'Salvando…' : id ? 'Salvar alterações' : 'Cadastrar igreja'}
          </button>
        </div>
      </form>

      {id && (
        <>
          <MinistrosDaIgreja igrejaId={id} />
          <section className="painel painel-perigo">
            <h2>Arquivar igreja</h2>
            <p className="detalhe">
              A igreja sai das listas, mas nada se apaga: o histórico dos ministros que passaram por ela continua guardado.
            </p>
            <BotaoConfirmar
              texto="Arquivar igreja"
              confirmar="Confirmar arquivamento"
              aviso={`Arquivar "${igreja?.nome}"?`}
              aoConfirmar={() => void arquivar()}
            />
          </section>
        </>
      )}
    </>
  )
}

function MinistrosDaIgreja({ igrejaId }: { igrejaId: string }) {
  const [carga, recarregar] = useCarregar(() => ministrosDaIgreja(igrejaId))
  return (
    <section className="painel" aria-labelledby="titulo-ministros-igreja">
      <h2 id="titulo-ministros-igreja">Ministros desta igreja</h2>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(ministros) =>
          ministros.length === 0 ? (
            <p className="vazio">Nenhum associado vinculado a esta igreja.</p>
          ) : (
            <ul className="lista-simples">
              {ministros.map((m) => (
                <li key={m.pessoa_id}>
                  <Link to={`/ministros/${m.pessoa_id}`}>{m.nome}</Link>
                  <span className="detalhe">
                    {[m.titulo, m.funcao, m.pastor_presidente && 'pastor presidente'].filter(Boolean).join(' · ')}
                  </span>
                </li>
              ))}
            </ul>
          )
        }
      </MostrarCarga>
    </section>
  )
}
