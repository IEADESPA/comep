import { Link } from 'react-router'
import { Aviso, Carregando } from '../../componentes/Basicos'
import { Icone, Ladrilho } from '../../componentes/Icone'
import { ehDaDiretoria, perfisEfetivos } from '../../componentes/menu'
import { ok } from '../../dados/cliente'
import { buscarConfigCredencial } from '../../dados/credencial'
import { situacaoDe } from '../../dados/financeiro'
import { meuPedido, type Pedido } from '../../dados/pedidos'
import { NOME_DO_PERFIL, type MinhaConta } from '../../dados/perfis'
import { useSessao } from '../../estado/contexto'
import { useCarregar } from '../../estado/useCarregar'
import { agendaProxima, paraVoce, type ItemParaVoce } from '../../estado/resumos'
import { dataPorExtenso, diaEMes, formatarData, saudacaoDaHora } from '../../utilitarios/formatos'
import { SecaoModulos } from './Modulos'

// Início do sistema (aprovado: Opção 2, "Menu vermelho e blocos por assunto", com o menu curto).
// Blocos: o que precisa de você, a agenda dos próximos dias (diretoria) ou a credencial (ministro), e os
// módulos agrupados por assunto. Quem ainda não tem perfil vê o pedido de associação em passos.

export function Inicio() {
  const { estado, recarregarConta } = useSessao()

  if (estado.situacao !== 'logado' || estado.conta === null) {
    return <Carregando texto="Carregando o seu cadastro…" />
  }

  const resultado = estado.conta
  switch (resultado.tipo) {
    case 'banco_nao_preparado':
      return (
        <Aviso titulo="Banco de dados ainda não preparado">
          <p>As tabelas do sistema ainda não foram criadas neste projeto.</p>
          <p className="detalhe">Equipe técnica: aplicar as migrações da pasta supabase/migrations.</p>
        </Aviso>
      )
    case 'sem_cadastro':
      return (
        <Aviso titulo="Cadastro não encontrado">
          <p>
            O seu login ({estado.sessao.email ?? 'sem e-mail'}) ainda não está ligado a um cadastro no Conselho. Procure a
            secretaria.
          </p>
        </Aviso>
      )
    case 'erro':
      return (
        <Aviso titulo="Algo deu errado">
          <p>{resultado.mensagem}</p>
          <button type="button" className="botao" onClick={recarregarConta}>
            Tentar de novo
          </button>
        </Aviso>
      )
    case 'ok':
      return <InicioDaConta key={resultado.conta.pessoaId} conta={resultado.conta} />
  }
}

function InicioDaConta({ conta }: { conta: MinhaConta }) {
  const primeiroNome = conta.nome.split(' ')[0]
  const diretoria = ehDaDiretoria(conta.perfis)
  const ministro = perfisEfetivos(conta.perfis).has('ministro')

  return (
    <div className="inicio">
      <div className="inicio-cabecalho">
        <h1>
          {saudacaoDaHora()}, {primeiroNome}
        </h1>
        <p className="inicio-data">{dataPorExtenso()}</p>
        {conta.perfis.length > 0 && (
          <ul className="perfis" aria-label="Seus perfis">
            {conta.perfis.map((perfil) => (
              <li key={perfil}>{NOME_DO_PERFIL[perfil]}</li>
            ))}
          </ul>
        )}
      </div>

      {conta.perfis.length === 0 ? (
        <InicioSemPerfil pessoaId={conta.pessoaId} />
      ) : (
        <>
          <div className="inicio-blocos">
            <ParaVoce conta={conta} titulo={diretoria ? 'Precisa de você' : 'Para você'} />
            {diretoria ? <Agenda conta={conta} /> : ministro ? <CredencialNoInicio conta={conta} /> : null}
          </div>
          <SecaoModulos perfis={conta.perfis} />
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------

function ParaVoce({ conta, titulo }: { conta: MinhaConta; titulo: string }) {
  const [carga] = useCarregar(async () => ok(await paraVoce(conta)))
  return (
    <section className="bloco bloco-pv" aria-labelledby="titulo-para-voce">
      <h2 id="titulo-para-voce">{titulo}</h2>
      {carga.situacao !== 'ok' ? (
        <Carregando />
      ) : carga.dados.length === 0 ? (
        <p className="pv-vazio">Nada esperando por você agora.</p>
      ) : (
        <ul className="pv-lista" aria-labelledby="titulo-para-voce">
          {carga.dados.map((item) => (
            <li key={item.chave}>
              <LinhaParaVoce item={item} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function LinhaParaVoce({ item }: { item: ItemParaVoce }) {
  return (
    <Link to={item.para} className={item.contagem ? 'pv-item' : 'pv-item pv-duas'}>
      <Ladrilho area={item.area} icone={item.icone} tamanho={40} />
      <span className="pv-corpo">
        <strong>{item.forte}</strong> <span className="pv-detalhe">{item.texto}</span>
      </span>
      <span
        className={item.contagem ? 'pv-acao pv-acao-texto' : item.principal ? 'pv-acao pv-acao-principal' : 'pv-acao'}
        aria-hidden="true"
      >
        {item.acao}
      </span>
      <span className="pv-seta" aria-hidden="true">
        <Icone nome="seta" />
      </span>
    </Link>
  )
}

function Agenda({ conta }: { conta: MinhaConta }) {
  const [carga] = useCarregar(async () => ok(await agendaProxima(conta.perfis)))
  return (
    <section className="bloco" aria-labelledby="titulo-agenda">
      <h2 id="titulo-agenda">Hoje e próximos dias</h2>
      {carga.situacao !== 'ok' ? (
        <Carregando />
      ) : carga.dados.length === 0 ? (
        <p className="pv-vazio">Nada marcado para os próximos dias.</p>
      ) : (
        <ul className="agenda-lista" aria-labelledby="titulo-agenda">
          {carga.dados.map((a) => {
            const { dia, mes } = diaEMes(a.inicio)
            return (
              <li key={a.chave}>
                <Link to={a.para} className="agenda-item">
                  <span className={`data-caixa area-${a.area}`} aria-hidden="true">
                    <strong>{dia}</strong>
                    <span>{mes}</span>
                  </span>
                  <span className="agenda-corpo">
                    <span className="somente-leitor">{`${dia}/${mes}: `}</span>
                    <strong>{a.titulo}</strong>
                    {a.detalhe && <span>{a.detalhe}</span>}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function CredencialNoInicio({ conta }: { conta: MinhaConta }) {
  const [carga] = useCarregar(async () => {
    const [situacao, config] = await Promise.all([situacaoDe(conta.pessoaId), buscarConfigCredencial()])
    return ok({ situacao: situacao.dados, fim: config.dados?.fim_mandato ?? null })
  })
  const dados = carga.situacao === 'ok' ? carga.dados : null
  const linha = [
    dados?.situacao ? `Nº ${String(dados.situacao.numero_registro).padStart(4, '0')}` : null,
    dados?.fim ? `válida até ${formatarData(dados.fim)}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <section className="cartao-credencial-inicio" aria-labelledby="titulo-credencial-inicio">
      <span className="rotulo" id="titulo-credencial-inicio">
        Credencial digital
      </span>
      <strong>{conta.nome}</strong>
      {linha && <span>{linha}</span>}
      <Link to="/minha-credencial" className="botao-branco">
        <Icone nome="qr" tamanho={18} />
        Mostrar a credencial
      </Link>
    </section>
  )
}

// ---------------------------------------------------------------------
// Quem ainda não tem perfil (candidato à associação)
// ---------------------------------------------------------------------

type Passo = { titulo: string; detalhe: string; estado: 'feito' | 'agora' | 'depois' }

function passosDoPedido(pedido: Pedido | null): Passo[] {
  const analise = 'Análise da secretaria'
  const assembleia = 'Aprovação na assembleia'
  if (!pedido || pedido.situacao === 'recusado' || pedido.situacao === 'desistiu') {
    return [
      { titulo: 'Fazer o pedido', detalhe: 'os seus dados e os documentos', estado: 'agora' },
      { titulo: analise, detalhe: 'depois do envio', estado: 'depois' },
      { titulo: assembleia, detalhe: 'na Assembleia Ordinária', estado: 'depois' },
    ]
  }
  const enviado = { titulo: 'Pedido enviado', detalhe: formatarData(pedido.enviado_em ?? pedido.criado_em), estado: 'feito' as const }
  if (pedido.situacao === 'enviado' || pedido.situacao === 'pendencia') {
    return [
      enviado,
      { titulo: analise, detalhe: pedido.situacao === 'pendencia' ? 'falta corrigir uma coisa' : 'em andamento', estado: 'agora' },
      { titulo: assembleia, detalhe: 'na próxima Assembleia Ordinária', estado: 'depois' },
    ]
  }
  return [
    enviado,
    { titulo: analise, detalhe: 'concluída', estado: 'feito' },
    {
      titulo: assembleia,
      detalhe: pedido.situacao === 'aprovado' ? 'aprovado' : pedido.assembleia_data ? `em ${formatarData(pedido.assembleia_data)}` : 'na próxima Assembleia Ordinária',
      estado: pedido.situacao === 'aprovado' ? 'feito' : 'agora',
    },
  ]
}

function InicioSemPerfil({ pessoaId }: { pessoaId: string }) {
  const [carga] = useCarregar(() => meuPedido(pessoaId))
  const pedido = carga.situacao === 'ok' ? carga.dados : null
  const semPedido = !pedido || pedido.situacao === 'recusado' || pedido.situacao === 'desistiu'
  const explica =
    pedido?.situacao === 'pendencia'
      ? 'A secretaria pediu uma correção. Abra o pedido para ver o que falta.'
      : pedido?.situacao === 'recusado'
        ? 'O último pedido foi recusado. Você pode fazer um novo.'
        : semPedido
          ? 'Preencha os seus dados e envie os documentos. A secretaria confere e o pedido vai para a assembleia.'
          : 'A secretaria confere os seus dados e documentos. Se faltar alguma coisa, o aviso aparece aqui e no sino.'

  return (
    <>
      <section className="bloco" aria-labelledby="titulo-pedido-inicio">
        <h2 id="titulo-pedido-inicio">Seu pedido de associação</h2>
        {carga.situacao === 'carregando' ? (
          <Carregando />
        ) : (
          <>
            <ol className="passos passos-linha">
              {passosDoPedido(pedido).map((p, i) => (
                <li key={p.titulo} className={`passo passo-${p.estado}`}>
                  <span className="passo-bola" aria-hidden="true">
                    {p.estado === 'feito' ? <Icone nome="check" tamanho={18} traco={3} /> : i + 1}
                  </span>
                  <span className="passo-texto">
                    <strong>{p.titulo}</strong>
                    <span>{p.detalhe}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="texto-bloco">{explica}</p>
            <Link to="/meu-pedido" className="link-forte">
              {semPedido ? 'Fazer o meu pedido →' : 'Ver o meu pedido →'}
            </Link>
          </>
        )}
      </section>
      <div className="inicio-duas">
        <section className="bloco" aria-labelledby="titulo-ja-associado">
          <h2 id="titulo-ja-associado" style={{ fontSize: 16 }}>
            Já é associado do COMEP?
          </h2>
          <p className="texto-bloco">
            Peça à secretaria o código de primeiro acesso para ligar o seu cadastro a um login. Este login ainda não tem
            nenhum perfil no sistema.
          </p>
        </section>
        <section className="bloco" aria-labelledby="titulo-enquanto-isso">
          <h2 id="titulo-enquanto-isso" style={{ fontSize: 16 }}>
            Enquanto isso
          </h2>
          <p className="texto-bloco">Confira a agenda do COMEP e os avisos no site.</p>
          <Link to="/" className="link-forte">
            Abrir o site →
          </Link>
        </section>
      </div>
    </>
  )
}
