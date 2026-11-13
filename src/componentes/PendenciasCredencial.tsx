import { Link } from 'react-router'

/** O que falta para a credencial (Fase 3.1). Lista vazia = credencial completa. */
export function PendenciasCredencial({
  pendencias,
  propria = false,
  verEm,
}: {
  pendencias: string[]
  propria?: boolean
  /** Endereço da tela da credencial (ex.: /credenciais/<pessoa>) */
  verEm?: string
}) {
  return (
    <section className="painel" aria-labelledby="titulo-pendencias-credencial">
      <h2 id="titulo-pendencias-credencial">{propria ? 'Minha credencial' : 'Credencial'}</h2>
      {pendencias.length === 0 ? (
        <p>
          <span className="etiqueta etiqueta-ok">Completa</span> Todos os dados da credencial estão preenchidos.
        </p>
      ) : (
        <>
          <p>Para a credencial ficar completa, falta:</p>
          <ul className="lista-pendencias" aria-label="Pendências da credencial">
            {pendencias.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <p className="detalhe">
            {propria
              ? 'Foto, CPF e filiação você preenche aqui no seu perfil. Título, igreja e função são com a secretaria. A sigla e o CNPJ da igreja: o pastor presidente informa (o CNPJ, à secretaria).'
              : 'Foto, CPF e filiação: o próprio associado preenche no perfil, ou a secretaria aqui. Sigla e CNPJ: no cadastro da igreja.'}
          </p>
        </>
      )}
      {verEm && (
        <p>
          <Link to={verEm}>Ver a credencial (digital e impressão)</Link>
        </p>
      )}
    </section>
  )
}
