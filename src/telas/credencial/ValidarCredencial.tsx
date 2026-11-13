// /validar/:codigo — página pública que o QR Code da credencial abre (sem login).
// Mostra só o necessário: foto, nome, título, nº de registro, igreja (sigla) e a situação DE AGORA.
import { useParams } from 'react-router'
import { MostrarCarga } from '../../componentes/Basicos'
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
      <p className="detalhe validacao-nota">
        Esta página mostra a situação no momento da consulta. A credencial não traz validade impressa: vale o que aparece
        aqui.
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
          ? 'Credencial vencida (fim do mandato) — aguardando a renovação'
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
            ? `${vencida ? 'Venceu' : 'Válida até'} ${formatarData(v.valida_ate)} (fim do mandato da diretoria)`
            : 'Válida enquanto o associado estiver ativo'}
        </li>
      </ul>
      <p className="detalhe">Consultado em {formatarDataHora(v.consultado_em)}.</p>
    </section>
  )
}
