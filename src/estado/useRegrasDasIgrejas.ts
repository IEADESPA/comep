import { useEffect, useState } from 'react'
import { REGRAS_PADRAO, regrasDasIgrejas, type RegrasIgrejas } from '../dados/igrejas'

// As regras da regularização (decisões do presidente de 26/11/2026) para os textos que prometem prazos (achado S7-07
// da revisão): os dias saem da configuração que a presidência muda na Central de regularização, e não ficam escritos
// fixos nas telas. Uma busca só por carga da página; a Central esquece a cópia quando salva.

let guardadas: Promise<RegrasIgrejas> | null = null

/** As regras salvas; até chegarem (ou se a leitura falhar), os padrões do banco. */
export function useRegrasDasIgrejas(): RegrasIgrejas {
  const [regras, setRegras] = useState<RegrasIgrejas>(REGRAS_PADRAO)
  useEffect(() => {
    let ativo = true
    guardadas ??= regrasDasIgrejas().then((r) => {
      if (r.erro === null) return r.dados
      guardadas = null // a leitura falhou: a próxima tela tenta de novo
      return REGRAS_PADRAO
    })
    void guardadas.then((r) => {
      if (ativo) setRegras(r)
    })
    return () => {
      ativo = false
    }
  }, [])
  return regras
}

/** Depois de salvar as regras, as telas leem de novo. */
export function esquecerRegrasDasIgrejas(): void {
  guardadas = null
}
