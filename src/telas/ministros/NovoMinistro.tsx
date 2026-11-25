import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Aviso, Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { Icone } from '../../componentes/Icone'
import { CabecalhoFuncao } from '../../componentes/MenuDoModulo'
import { cadastrarAssociado, NOME_DA_FORMA_ADMISSAO, SUGESTOES_FUNCAO, type NovoAssociado } from '../../dados/associados'
import { listarIgrejas, listarTitulos, type Igreja, type Titulo } from '../../dados/cadastros'
import { ok } from '../../dados/cliente'
import { useCarregar } from '../../estado/useCarregar'
import { hojeIso } from '../../utilitarios/formatos'
import { TAMANHO_DO_NOME, TAMANHO_DO_TELEFONE } from '../../utilitarios/textoLimpo'

// Ministros e inscrições › Cadastrar ministro (aprovado em 18/11/2026: opção 2, o passo a passo).
// Três passos, um de cada vez, com os passos marcados no alto e "Continuar": 1 Dados pessoais,
// 2 Igreja e ministério, 3 No COMEP. Para quem JÁ é associado (Art. 7º, a); os novos fazem o pedido pelo site.

const PASSOS = ['Dados pessoais', 'Igreja e ministério', 'No COMEP'] as const

export function NovoMinistro() {
  const [carga, recarregar] = useCarregar(async () => {
    const [titulos, igrejas] = await Promise.all([listarTitulos(), listarIgrejas()])
    if (titulos.erro !== null) return titulos
    if (igrejas.erro !== null) return igrejas
    return ok({ titulos: titulos.dados, igrejas: igrejas.dados })
  })

  return (
    <div className="tela-nova">
      <CabecalhoFuncao
        modulo="Ministros e inscrições"
        titulo="Cadastrar ministro"
        sub={
          <>
            Para quem <strong>já é associado</strong> do COMEP (Art. 7º, a). Quem quer se associar agora faz o pedido pelo site e passa
            pela Assembleia Ordinária.
          </>
        }
      />
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {({ titulos, igrejas }) =>
          igrejas.length === 0 ? (
            <Aviso titulo="Cadastre a igreja primeiro">
              <p>Todo associado precisa estar ligado a uma igreja (Art. 7º, §1º).</p>
              <p>
                <Link to="/igrejas/nova">Cadastrar igreja</Link>
              </p>
            </Aviso>
          ) : (
            <PassoAPasso titulos={titulos} igrejas={igrejas} />
          )
        }
      </MostrarCarga>
    </div>
  )
}

function PassosNoAlto({ atual }: { atual: number }) {
  return (
    <>
      <ol className="passos-cadastro so-computador" aria-label="Passos do cadastro">
        {PASSOS.map((nome, i) => (
          <li key={nome} className={i < atual ? 'feito' : undefined} aria-current={i === atual ? 'step' : undefined}>
            <span className="numero-passo" aria-hidden="true">
              {i < atual ? <Icone nome="check" tamanho={16} traco={3} /> : i + 1}
            </span>
            {nome}
          </li>
        ))}
      </ol>
      <div className="passos-tracos so-celular" aria-hidden="true">
        {PASSOS.map((nome, i) => (
          <span key={nome} className={i <= atual ? 'feito' : undefined} />
        ))}
      </div>
    </>
  )
}

function PassoAPasso({ titulos, igrejas }: { titulos: Titulo[]; igrejas: Igreja[] }) {
  const navigate = useNavigate()
  const [passo, setPasso] = useState(0)
  const [dados, setDados] = useState<NovoAssociado>({
    nome: '',
    email: '',
    telefone: '',
    tituloId: '',
    tituloDesde: '',
    igrejaId: '',
    funcao: '',
    vinculoInicio: '',
    admitidoEm: '',
    observacoes: '',
    pastorPresidente: false,
    jubilado: false,
  })
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const titulo = useRef<HTMLHeadingElement>(null)
  const hoje = hojeIso()

  const campo = (nome: Exclude<keyof NovoAssociado, 'pastorPresidente' | 'jubilado'>) => ({
    value: dados[nome],
    onChange: (e: { target: { value: string } }) => setDados((d) => ({ ...d, [nome]: e.target.value })),
  })

  function irPara(n: number) {
    setPasso(n)
    setErro(null)
    // o leitor de tela e o teclado vão para o título do passo novo
    setTimeout(() => titulo.current?.focus(), 0)
  }

  async function cadastrar() {
    setEnviando(true)
    const r = await cadastrarAssociado(dados)
    setEnviando(false)
    if (r.erro !== null) {
      setErro(r.erro)
      return
    }
    navigate(`/ministros/${r.dados}`, { replace: true, state: { mensagem: 'Ministro cadastrado.' } })
  }

  return (
    <form
      className="cadastro-passo"
      aria-label="Cadastrar ministro"
      onSubmit={(e) => {
        e.preventDefault()
        if (passo < PASSOS.length - 1) irPara(passo + 1)
        else void cadastrar()
      }}
    >
      <PassosNoAlto atual={passo} />
      <section className="bloco">
        <h2 ref={titulo} tabIndex={-1}>
          <span className="so-celular">
            {passo + 1} de {PASSOS.length} ·{' '}
          </span>
          <span className="so-computador">{passo + 1} · </span>
          {PASSOS[passo]}
        </h2>

        {passo === 0 && (
          <div className="grade-form">
            <label className="largura-total">
              Nome completo *
              <input required autoComplete="off" placeholder="Nome e sobrenomes" maxLength={TAMANHO_DO_NOME} {...campo('nome')} />
            </label>
            <label>
              Telefone (WhatsApp)
              <input type="tel" placeholder="(94) 9____-____" maxLength={TAMANHO_DO_TELEFONE} {...campo('telefone')} />
            </label>
            <label>
              E-mail
              <input type="email" placeholder="nome@email.com" {...campo('email')} />
            </label>
            <p className="detalhe largura-total">O CPF e a filiação entram depois, na ficha (aba Dados): vão na credencial.</p>
          </div>
        )}

        {passo === 1 && (
          <div className="grade-form">
            <label>
              Igreja *
              <select required {...campo('igrejaId')}>
                <option value="">— Escolha a igreja —</option>
                {igrejas.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nome}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Função na igreja
              <input list="sugestoes-funcao" {...campo('funcao')} />
              <datalist id="sugestoes-funcao">
                {SUGESTOES_FUNCAO.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </label>
            <label>
              Nesta igreja desde
              <input type="date" max={hoje} {...campo('vinculoInicio')} />
            </label>
            <label className="caixa-marcar">
              <input
                type="checkbox"
                checked={dados.pastorPresidente}
                onChange={(e) => setDados((d) => ({ ...d, pastorPresidente: e.target.checked }))}
              />
              É o pastor presidente desta igreja (perfil e contribuição de presidente de igreja)
            </label>
            <label>
              Título ministerial *
              <select required {...campo('tituloId')}>
                <option value="">— Escolha —</option>
                {titulos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Data de consagração
              <input type="date" max={hoje} {...campo('tituloDesde')} />
            </label>
            <p className="detalhe largura-total">
              Todo ministro do COMEP é ligado a uma igreja: não há ministro sem igreja. Se a igreja dele ainda não está na lista,{' '}
              <Link to="/igrejas/nova">cadastre a igreja</Link> primeiro.
            </p>
          </div>
        )}

        {passo === 2 && (
          <div className="grade-form">
            <p className="largura-total">
              Forma de admissão: <strong>{NOME_DA_FORMA_ADMISSAO.cadastro_inicial}</strong>
            </p>
            <label>
              Associado desde
              <input type="date" max={hoje} {...campo('admitidoEm')} />
            </label>
            <label className="caixa-marcar">
              <input type="checkbox" checked={dados.jubilado} onChange={(e) => setDados((d) => ({ ...d, jubilado: e.target.checked }))} />
              Jubilado (isento da contribuição)
            </label>
            <label className="largura-total">
              Observações
              <textarea rows={2} {...campo('observacoes')} />
            </label>
            <p className="detalhe largura-total">
              O número de registro é gerado sozinho. A contribuição segue a categoria (pastor presidente, não presidente ou
              jubilado), com os valores de Configurações.
            </p>
          </div>
        )}
      </section>

      <Mensagem erro={erro} />
      <div className="botoes-passo">
        {passo === 0 ? (
          <Link to="/ministros" className="botao botao-secundario">
            Cancelar
          </Link>
        ) : (
          <button type="button" className="botao botao-secundario" onClick={() => irPara(passo - 1)}>
            Voltar
          </button>
        )}
        {passo < PASSOS.length - 1 ? (
          <button type="submit" className="botao">
            Continuar → {PASSOS[passo + 1]}
          </button>
        ) : (
          <button type="submit" className="botao" disabled={enviando}>
            {enviando ? 'Cadastrando…' : 'Cadastrar o ministro'}
          </button>
        )}
      </div>
    </form>
  )
}
