// Credencial do associado — frente e verso no tamanho de cartão (CR80: 85,6 × 54 mm).
// O mesmo desenho serve para a tela (digital) e para a impressão (tamanho real).
// Validade NÃO vai impressa: o QR Code do verso mostra a situação de agora (PROJETO.md, seção 4.5).
import type { DadosCredencial } from '../dados/credencial'
import { formatarCnpj, formatarCpf, formatarData } from '../utilitarios/formatos'
import { QrCode } from './QrCode'

const NOME_COMPLETO = 'Conselho de Ministros Evangélicos de Parauapebas'

const ou = (valor: string | null | undefined) => valor || '—'

function Topo() {
  return (
    <header className="cred-topo">
      <img className="cred-logo" src={`${import.meta.env.BASE_URL}logo.svg`} alt="" />
      <div className="cred-org">
        <span className="cred-org-nome">{NOME_COMPLETO}</span>
        <strong className="cred-sigla">COMEP</strong>
      </div>
      <span className="cred-tipo">
        Credencial
        <br />
        de associado
      </span>
    </header>
  )
}

export function CredencialFrente({ c, foto }: { c: DadosCredencial; foto: string | null }) {
  const igreja = c.igreja_sigla || c.igreja
  return (
    <article className="credencial credencial-frente" aria-label={`Credencial de ${c.nome} — frente`}>
      <Topo />
      <div className="cred-corpo">
        <div className="cred-foto">{foto ? <img src={foto} alt={`Foto de ${c.nome}`} /> : <span>sem foto</span>}</div>
        <div className="cred-dados">
          <p className="cred-nome">{c.nome}</p>
          <p className="cred-titulo">{[c.titulo, c.funcao].filter(Boolean).join(' · ') || '—'}</p>
          <dl>
            <div className="cred-par">
              <div>
                <dt>CPF</dt>
                <dd>{c.cpf ? formatarCpf(c.cpf) : '—'}</dd>
              </div>
              <div>
                <dt>Nº de registro</dt>
                <dd>{String(c.numero_registro).padStart(4, '0')}</dd>
              </div>
            </div>
            <div className="cred-par">
              <div>
                <dt>Associado desde</dt>
                <dd>{c.admitido_em ? formatarData(c.admitido_em) : '—'}</dd>
              </div>
              <div>
                <dt>Igreja</dt>
                <dd>{ou(igreja)}</dd>
              </div>
            </div>
            <div>
              <dt>CNPJ da igreja</dt>
              <dd>{c.igreja_cnpj ? formatarCnpj(c.igreja_cnpj) : '—'}</dd>
            </div>
          </dl>
        </div>
      </div>
      <footer className="cred-rodape">Situação e validade: confira pelo QR Code no verso</footer>
    </article>
  )
}

export function CredencialVerso({ c, textoVerso, url }: { c: DadosCredencial; textoVerso: string; url: string }) {
  return (
    <article className="credencial credencial-verso" aria-label={`Credencial de ${c.nome} — verso`}>
      <div className="cred-faixa" />
      <div className="cred-verso-corpo">
        <div className="cred-qr">
          <QrCode texto={url} rotulo={`QR Code de validação da credencial de ${c.nome}`} />
          <span>Aponte a câmera e confira a situação atual</span>
        </div>
        <div className="cred-verso-texto">
          <dl>
            <div>
              <dt>Filiação</dt>
              <dd>{ou(c.nome_mae)}</dd>
              {c.nome_pai && <dd>{c.nome_pai}</dd>}
            </div>
          </dl>
          <p className="cred-texto-verso">{textoVerso}</p>
          <div className="cred-assinatura">
            <span className="cred-linha-assinatura" />
            Presidente do COMEP
          </div>
        </div>
      </div>
      <footer className="cred-rodape">
        {NOME_COMPLETO} · Parauapebas/PA · Nº {String(c.numero_registro).padStart(4, '0')}
      </footer>
    </article>
  )
}
