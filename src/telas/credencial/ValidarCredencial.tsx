// /validar/:codigo — página pública que o QR Code da credencial abre (sem login).
// Mostra só o necessário: foto, nome, título, nº de registro, igreja (sigla) e a situação DE AGORA.
import { useState } from 'react'
import { useParams } from 'react-router'
import { Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { encontrosComPresencaAberta, registrarPresencaPorCodigo, type EncontroAberto } from '../../dados/encontros'
import { useSessao } from '../../estado/contexto'
import { useUmaVez } from '../../estado/useUmaVez'
import { urlFotoPublica, validarCredencial, type Validacao } from '../../dados/credencial'
import { useCarregar } from '../../estado/useCarregar'
import { formatarData, formatarDataHora } from '../../utilitarios/formatos'

export function ValidarCredencial() {
  const { codigo = '' } = useParams()
  const [carga, recarregar] = useCarregar(() => validarCredencial(codigo))
  return (
    <main className="validacao">
      <header className="validacao-topo">
        <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" width={40} height={40} />
        <div>
          <strong>COMEP</strong>
          <span>Conselho de Ministros Evangélicos de Parauapebas</span>
        </div>
      </header>
      <h1>Validação de credencial</h1>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(v) => <Resultado v={v} />}
      </MostrarCarga>
      <MarcarPresenca codigo={codigo} />
      <p className="detalhe validacao-nota">
        Esta página mostra a situação no momento da consulta. A credencial vale até o fim do mandato da diretoria; a
        impressa precisa ser impressa de novo a cada novo mandato.
      </p>
    </main>
  )
}

function Resultado({ v }: { v: Validacao }) {
  if (v.situacao === 'inexistente') {
    return (
      <section className="validacao-cartao validacao-invalida" aria-label="Resultado da validação">
        <p className="validacao-situacao">Credencial não encontrada</p>
        <p>Este código não corresponde a nenhuma credencial do COMEP. Confira se o QR Code foi lido inteiro.</p>
      </section>
    )
  }
  if (v.situacao === 'substituida') {
    return (
      <section className="validacao-cartao validacao-invalida" aria-label="Resultado da validação">
        <p className="validacao-situacao">Credencial substituída — não vale mais</p>
        <p>Esta credencial foi trocada por uma nova em {v.substituida_em ? formatarDataHora(v.substituida_em) : '—'}.</p>
      </section>
    )
  }
  if (v.situacao === 'inativa') {
    return (
      <section className="validacao-cartao validacao-invalida" aria-label="Resultado da validação">
        <p className="validacao-situacao">Associado sem vínculo ativo</p>
        <p>{v.nome ? `${v.nome} não é associado ativo do COMEP no momento.` : 'Esta credencial não está ativa.'}</p>
      </section>
    )
  }
  const vencida = v.situacao === 'vencida'
  const classe = vencida ? 'validacao-invalida' : v.em_dia ? 'validacao-valida' : 'validacao-atencao'
  return (
    <section className={`validacao-cartao ${classe}`} aria-label="Resultado da validação">
      <p className="validacao-situacao">
        {vencida
          ? v.renovada
            ? 'Credencial vencida — é de um mandato anterior'
            : 'Credencial vencida (fim do mandato) — aguardando a renovação'
          : v.em_dia
            ? 'Credencial válida'
            : 'Credencial válida — contribuição em atraso'}
      </p>
      <div className="validacao-pessoa">
        {v.foto_publica ? (
          <img src={urlFotoPublica(v.foto_publica)} alt={`Foto de ${v.nome}`} />
        ) : (
          <div className="validacao-sem-foto">sem foto</div>
        )}
        <dl>
          <dt>Nome</dt>
          <dd>{v.nome}</dd>
          <dt>Título</dt>
          <dd>{v.titulo ?? '—'}</dd>
          <dt>Nº de registro</dt>
          <dd>{String(v.numero_registro ?? '').padStart(4, '0')}</dd>
          <dt>Igreja</dt>
          <dd>{v.igreja ?? '—'}</dd>
        </dl>
      </div>
      <ul className="validacao-itens">
        <li>Associado ativo do COMEP</li>
        <li>{v.em_dia ? 'Em dia com a contribuição: apto a votar e ser votado (Art. 11)' : 'Contribuição em atraso: inapto para votar até regularizar (Art. 11)'}</li>
        <li>
          {v.valida_ate
            ? `${vencida ? 'Venceu em' : 'Válida até'} ${formatarData(v.valida_ate)} (fim do mandato da diretoria)`
            : 'Válida enquanto o associado estiver ativo'}
        </li>
        {vencida && v.renovada && (
          <li>Esta credencial já foi renovada para o mandato atual: peça a credencial nova (a digital, no sistema, ou impressa de novo).</li>
        )}
      </ul>
      <p className="detalhe">Consultado em {formatarDataHora(v.consultado_em)}.</p>
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
