import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Aviso, Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { cadastrarAssociado, SUGESTOES_FUNCAO, type NovoAssociado } from '../../dados/associados'
import { listarIgrejas, listarTitulos, type Igreja, type Titulo } from '../../dados/cadastros'
import { ok } from '../../dados/cliente'
import { useCarregar } from '../../estado/useCarregar'
import { hojeIso } from '../../utilitarios/formatos'

/** Cadastro direto de quem já é associado (Art. 7º, a). Os novos entram pelo pedido de associação. */
export function NovoMinistro() {
  const [carga, recarregar] = useCarregar(async () => {
    const [titulos, igrejas] = await Promise.all([listarTitulos(), listarIgrejas()])
    if (titulos.erro !== null) return titulos
    if (igrejas.erro !== null) return igrejas
    return ok({ titulos: titulos.dados, igrejas: igrejas.dados })
  })

  return (
    <>
      <p className="trilha">
        <Link to="/ministros">← Ministros</Link>
      </p>
      <h1>Cadastrar associado</h1>
      <p className="detalhe">
        Para quem <strong>já é associado</strong> do COMEP (Art. 7º, a). Quem quer se associar agora faz o pedido pelo
        site e passa pela Assembleia Ordinária.
      </p>
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
            <Formulario titulos={titulos} igrejas={igrejas} />
          )
        }
      </MostrarCarga>
    </>
  )
}

function Formulario({ titulos, igrejas }: { titulos: Titulo[]; igrejas: Igreja[] }) {
  const navigate = useNavigate()
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
  const hoje = hojeIso()

  const campo = (nome: Exclude<keyof NovoAssociado, 'pastorPresidente' | 'jubilado'>) => ({
    value: dados[nome],
    onChange: (e: { target: { value: string } }) => setDados((d) => ({ ...d, [nome]: e.target.value })),
  })

  async function salvar() {
    setEnviando(true)
    const r = await cadastrarAssociado(dados)
    setEnviando(false)
    if (r.erro !== null) {
      setErro(r.erro)
      return
    }
    navigate(`/ministros/${r.dados}`, { replace: true, state: { mensagem: 'Associado cadastrado.' } })
  }

  return (
    <form
      className="painel"
      onSubmit={(e) => {
        e.preventDefault()
        void salvar()
      }}
    >
      <fieldset>
        <legend>Dados pessoais</legend>
        <div className="grade-form">
          <label className="largura-total">
            Nome completo *
            <input required autoComplete="off" {...campo('nome')} />
          </label>
          <label>
            Telefone (WhatsApp)
            <input type="tel" {...campo('telefone')} />
          </label>
          <label>
            E-mail
            <input type="email" {...campo('email')} />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Ministério</legend>
        <div className="grade-form">
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
          <label>
            Igreja *
            <select required {...campo('igrejaId')}>
              <option value="">— Escolha —</option>
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
          <label className="caixa-marcar largura-total">
            <input
              type="checkbox"
              checked={dados.pastorPresidente}
              onChange={(e) => setDados((d) => ({ ...d, pastorPresidente: e.target.checked }))}
            />
            É o pastor presidente desta igreja (perfil e contribuição de presidente de igreja)
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>No COMEP</legend>
        <div className="grade-form">
          <label>
            Associado desde
            <input type="date" max={hoje} {...campo('admitidoEm')} />
          </label>
          <label className="caixa-marcar">
            <input
              type="checkbox"
              checked={dados.jubilado}
              onChange={(e) => setDados((d) => ({ ...d, jubilado: e.target.checked }))}
            />
            Jubilado (isento da contribuição)
          </label>
          <label className="largura-total">
            Observações
            <textarea rows={2} {...campo('observacoes')} />
          </label>
        </div>
        <p className="detalhe">O número de registro é gerado automaticamente.</p>
      </fieldset>

      <Mensagem erro={erro} />
      <div className="acoes">
        <button type="submit" className="botao" disabled={enviando}>
          {enviando ? 'Cadastrando…' : 'Cadastrar associado'}
        </button>
      </div>
    </form>
  )
}
