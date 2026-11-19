// /validar/:codigo — página pública que o QR Code da credencial abre (sem login).
// Telas novas (Fase 5.5, aprovada: Opção 3, "a credencial com carimbo"): a credencial com o carimbo por cima
// (VÁLIDA, EM ATRASO, NÃO VALE) e, ao lado, a situação e os dados. O desenho do cartão aqui é o padrão do COMEP:
// a página pública não recebe o modelo editado da credencial.
// Mostra só o necessário: foto, nome, título, nº de registro, igreja (sigla) e a situação DE AGORA.
// Fase 5.5 (parte 8): o ministro em readequação (rodada 12, opção 1) aparece com a credencial cinza e a faixa de aviso,
// a igreja sem registro e o prazo. Nunca a frase "não representa o COMEP".
import { useState } from 'react'
import { useParams } from 'react-router'
import { Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { Simbolo, type Area } from '../../componentes/Icone'
import { QrCode } from '../../componentes/QrCode'
import { encontrosComPresencaAberta, registrarPresencaPorCodigo, type EncontroAberto } from '../../dados/encontros'
import { useSessao } from '../../estado/contexto'
import { useUmaVez } from '../../estado/useUmaVez'
import { urlFotoPublica, urlValidacao, validarCredencial, type Validacao } from '../../dados/credencial'
import { useCarregar } from '../../estado/useCarregar'
import { formatarData, formatarDataHora } from '../../utilitarios/formatos'

export function ValidarCredencial() {
  const { codigo = '' } = useParams()
  const [carga, recarregar] = useCarregar(() => validarCredencial(codigo))
  return (
    <div className="validacao-nova">
      <header className="topo-publico">
        <Simbolo tamanho={30} />
        <span className="nome-comep">COMEP</span>
        <span className="topo-publico-titulo">Validação de credencial</span>
      </header>
      <main className="validacao-corpo">
        <h1 className="somente-leitor">Validação de credencial</h1>
        <MostrarCarga carga={carga} recarregar={recarregar}>
          {(v) => <Resultado v={v} codigo={codigo} />}
        </MostrarCarga>
        <MarcarPresenca codigo={codigo} />
        <p className="detalhe validacao-nota">
          Esta página mostra a situação no momento da consulta. A credencial vale até o fim do mandato da diretoria; a
          impressa precisa ser impressa de novo a cada novo mandato.
        </p>
      </main>
    </div>
  )
}

type Veredito = { titulo: string; sub: string; carimbo: string; area: Area }

function vereditoDe(v: Validacao): Veredito {
  if (v.situacao === 'inexistente') {
    return {
      titulo: 'Credencial não encontrada',
      sub: 'Este código não corresponde a nenhuma credencial do COMEP. Confira se o QR Code foi lido inteiro.',
      carimbo: 'NÃO VALE',
      area: 'pessoas',
    }
  }
  if (v.situacao === 'substituida') {
    return {
      titulo: 'Credencial substituída — não vale mais',
      sub: `Esta credencial foi trocada por uma nova em ${v.substituida_em ? formatarDataHora(v.substituida_em) : '—'}.`,
      carimbo: 'NÃO VALE',
      area: 'pessoas',
    }
  }
  if (v.situacao === 'inativa') {
    return {
      titulo: 'Associado sem vínculo ativo',
      sub: v.nome ? `${v.nome} não é associado ativo do COMEP no momento.` : 'Esta credencial não está ativa.',
      carimbo: 'NÃO VALE',
      area: 'pessoas',
    }
  }
  if (v.situacao === 'vencida') {
    return {
      titulo: v.renovada ? 'Credencial vencida — é de um mandato anterior' : 'Credencial vencida (fim do mandato) — aguardando a renovação',
      sub: v.renovada
        ? 'Esta credencial já foi renovada para o mandato atual: peça a credencial nova (a digital, no sistema, ou impressa de novo).'
        : 'O associado continua ativo; a credencial nova sai com a renovação do mandato.',
      carimbo: 'VENCIDA',
      area: 'pessoas',
    }
  }
  if (v.readequacao) {
    return {
      titulo: 'Credencial válida — ministro em readequação',
      sub: `A igreja dele ainda não tem registro: participa, mas não vota, não é votado e não tem cargo.${
        v.prazo_readequacao ? ` Prazo da readequação: até ${formatarData(v.prazo_readequacao)}.` : ''
      }`,
      carimbo: 'EM READEQUAÇÃO',
      area: 'eventos',
    }
  }
  return v.em_dia
    ? { titulo: 'Credencial válida', sub: 'Ministro associado e em dia com o COMEP.', carimbo: 'VÁLIDA', area: 'financas' }
    : {
        titulo: 'Credencial válida — contribuição em atraso',
        sub: 'Associado ativo, mas com a contribuição em atraso: inapto para votar até regularizar (Art. 11).',
        carimbo: 'EM ATRASO',
        area: 'eventos',
      }
}

function Resultado({ v, codigo }: { v: Validacao; codigo: string }) {
  const r = vereditoDe(v)
  const temPessoa = v.situacao !== 'inexistente' && Boolean(v.nome)
  const numero = v.numero_registro ? String(v.numero_registro).padStart(4, '0') : null
  return (
    <section className={`validacao-resultado area-${r.area}`} aria-label="Resultado da validação">
      <div className="credencial-carimbada">
        <div className={v.readequacao ? 'credencial-publica credencial-publica-readequacao' : 'credencial-publica'} aria-hidden={!temPessoa}>
          <div className="credencial-publica-topo">
            <Simbolo tamanho={30} />
            <span>
              <strong>COMEP</strong>
              <span>Conselho de Ministros Evangélicos de Parauapebas</span>
            </span>
          </div>
          <div className="credencial-publica-corpo">
            {v.foto_publica ? (
              <img src={urlFotoPublica(v.foto_publica)} alt={`Foto de ${v.nome}`} />
            ) : (
              <span className="credencial-publica-sem-foto">{temPessoa ? 'sem foto' : '?'}</span>
            )}
            <span className="credencial-publica-dados">
              <strong>{temPessoa ? v.nome : 'Credencial não encontrada'}</strong>
              {v.titulo && <span className="credencial-publica-titulo">{v.titulo}</span>}
              {v.igreja && <span>{v.igreja}</span>}
              {numero && (
                <span>
                  Nº {numero}
                  {v.valida_ate && ` · válida até ${formatarData(v.valida_ate)}`}
                </span>
              )}
            </span>
            {temPessoa && <QrCode texto={urlValidacao(codigo)} rotulo="QR Code desta credencial" className="credencial-publica-qr" />}
          </div>
          {v.readequacao && (
            <div className="credencial-publica-faixa">
              <span>
                Em readequação · sem direito a voto
                {v.prazo_readequacao ? ` · prazo até ${formatarData(v.prazo_readequacao)}` : ''}
              </span>
            </div>
          )}
        </div>
        <span className="carimbo" aria-hidden="true">
          {r.carimbo}
        </span>
      </div>
      <div className="validacao-lado">
        <p className="validacao-titulo">{r.titulo}</p>
        <p>{r.sub}</p>
        {temPessoa && (
          <dl className="definicoes definicoes-fortes">
            <dt>Nome</dt>
            <dd>{v.nome}</dd>
            <dt>Título</dt>
            <dd>{v.titulo ?? '—'}</dd>
            <dt>Igreja</dt>
            <dd>{v.igreja ? `${v.igreja}${v.readequacao ? ' (sem registro)' : ''}` : '—'}</dd>
            <dt>Nº de registro</dt>
            <dd>{numero ?? '—'}</dd>
            {(v.situacao === 'valida' || v.situacao === 'vencida') && (
              <>
                <dt>Situação</dt>
                <dd>
                  {v.readequacao
                    ? `Ministro em readequação · participa, mas não vota${v.em_dia ? '' : ' · contribuição em atraso'}`
                    : v.em_dia
                      ? 'Ativo · em dia (apto a votar e ser votado)'
                      : 'Ativo · contribuição em atraso'}
                </dd>
                {v.readequacao && v.prazo_readequacao && (
                  <>
                    <dt>Prazo</dt>
                    <dd>Até {formatarData(v.prazo_readequacao)} (a AGO), para a igreja se regularizar</dd>
                  </>
                )}
                <dt>Validade</dt>
                <dd>
                  {v.valida_ate
                    ? `${v.situacao === 'vencida' ? 'Venceu em' : 'Até'} ${formatarData(v.valida_ate)} (fim do mandato)`
                    : 'Enquanto o associado estiver ativo'}
                </dd>
              </>
            )}
            <dt>Conferido</dt>
            <dd>{formatarDataHora(v.consultado_em)}</dd>
          </dl>
        )}
      </div>
    </section>
  )
}

/**
 * Check-in (Fase 4.2): a secretaria aponta a câmera do celular para o QR Code da credencial; esta página abre e,
 * se ela estiver logada e houver encontro com a lista de presença aberta, mostra o botão "Marcar presença".
 */
function MarcarPresenca({ codigo }: { codigo: string }) {
  const { estado } = useSessao()
  const perfis = estado.situacao === 'logado' && estado.conta?.tipo === 'ok' ? estado.conta.conta.perfis : []
  const podeMarcar = perfis.includes('secretaria') || perfis.includes('presidencia')
  if (!podeMarcar) return null
  return <BotoesDePresenca codigo={codigo} />
}

function BotoesDePresenca({ codigo }: { codigo: string }) {
  const [carga] = useCarregar(encontrosComPresencaAberta)
  const [retorno, setRetorno] = useState<{ sucesso?: string; erro?: string }>({})
  const [enviando, umaVez] = useUmaVez()
  if (carga.situacao !== 'ok' || carga.dados.length === 0) return null
  const marcar = (e: EncontroAberto) =>
    void umaVez(async () => {
      const r = await registrarPresencaPorCodigo(e.id, codigo)
      if (r.erro !== null) return setRetorno({ erro: r.erro })
      setRetorno({
        sucesso:
          r.dados.resultado === 'ja_presente'
            ? `${r.dados.nome} já estava presente em "${e.titulo}".`
            : `Presença registrada em "${e.titulo}": ${r.dados.nome}${r.dados.em_dia ? '' : ' (contribuição em atraso: não vota)'}.`,
      })
    })
  return (
    <section className="validacao-presenca" aria-label="Lista de presença">
      <p>
        <strong>Secretaria:</strong> lista de presença aberta.
      </p>
      <div className="acoes">
        {carga.dados.map((e) => (
          <button key={e.id} type="button" className="botao" disabled={enviando} onClick={() => marcar(e)}>
            Marcar presença em {e.titulo}
          </button>
        ))}
      </div>
      <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
    </section>
  )
}
