// CPF e filiação (pai e mãe): vão na credencial do associado (Fase 3.1).
// O próprio ministro preenche enquanto estão vazios; depois, só a secretaria corrige (o banco garante).
import type { IdentidadeGravada } from '../dados/credencial'
import { cpfValido, formatarCpf } from '../utilitarios/formatos'
import type { Identidade } from '../utilitarios/identidade'

export function CamposIdentidade({
  valor,
  gravada,
  aoMudar,
  livre = false,
  obrigatorio = false,
}: {
  valor: Identidade
  gravada: IdentidadeGravada
  aoMudar: (v: Identidade) => void
  /** Secretaria/presidência: corrige mesmo o que já foi preenchido */
  livre?: boolean
  /** Pedido de associação: CPF e nome da mãe obrigatórios */
  obrigatorio?: boolean
}) {
  const travado = (campo: keyof IdentidadeGravada) => !livre && gravada[campo] !== null
  const algumTravado = (['cpf', 'nome_pai', 'nome_mae'] as const).some(travado)
  return (
    <>
      <label>
        CPF{obrigatorio ? ' *' : ''}
        <input
          inputMode="numeric"
          autoComplete="off"
          placeholder="000.000.000-00"
          required={obrigatorio}
          disabled={travado('cpf')}
          value={valor.cpf}
          onChange={(e) => aoMudar({ ...valor, cpf: e.target.value })}
          onBlur={() => cpfValido(valor.cpf) && aoMudar({ ...valor, cpf: formatarCpf(valor.cpf) })}
        />
      </label>
      <label>
        Nome da mãe{obrigatorio ? ' *' : ''}
        <input
          required={obrigatorio}
          disabled={travado('nome_mae')}
          value={valor.nome_mae}
          onChange={(e) => aoMudar({ ...valor, nome_mae: e.target.value })}
        />
      </label>
      <label>
        Nome do pai
        <input disabled={travado('nome_pai')} value={valor.nome_pai} onChange={(e) => aoMudar({ ...valor, nome_pai: e.target.value })} />
      </label>
      {algumTravado && (
        <p className="detalhe largura-total">
          CPF e filiação vão na credencial: depois de preenchidos, só a secretaria corrige. Achou um erro? Fale com a secretaria.
        </p>
      )}
    </>
  )
}
