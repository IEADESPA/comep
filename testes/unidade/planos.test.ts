// "Valores e planos": quantos escolheram o ano inteiro e quantos pagam por mês contam só quem paga hoje (D-16).
// Rodar: npm test
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { contarPlanos } from '../../src/telas/financeiro/planos.ts'

// Pessoas fictícias (só os ids importam aqui)
const ANA = 'a0000000-0000-4000-8000-000000000001'
const BRUNO = 'a0000000-0000-4000-8000-000000000002'
const CARLOS = 'a0000000-0000-4000-8000-000000000003'
const DAVI = 'a0000000-0000-4000-8000-000000000004'
const QUEM_SAIU = 'a0000000-0000-4000-8000-000000000005'

describe('Os planos em "Valores e planos" (D-16)', () => {
  it('o plano de quem não é mais associado não conta (a homologação viu "268 escolheram o ano inteiro; os outros 0")', () => {
    const planos = [
      { pessoa_id: QUEM_SAIU, tipo: 'anual' as const },
      { pessoa_id: 'a0000000-0000-4000-8000-000000000006', tipo: 'anual' as const },
      { pessoa_id: ANA, tipo: 'anual' as const },
    ]
    const associados = [
      { pessoa_id: ANA, jubilado: false },
      { pessoa_id: BRUNO, jubilado: false },
      { pessoa_id: CARLOS, jubilado: false },
    ]
    assert.deepEqual(contarPlanos(planos, associados), { anual: 1, mensal: 2, pagantes: 3 })
  })

  it('o jubilado é isento: nem o plano dele nem ele entram na conta', () => {
    const planos = [
      { pessoa_id: DAVI, tipo: 'anual' as const },
      { pessoa_id: ANA, tipo: 'anual' as const },
    ]
    const associados = [
      { pessoa_id: ANA, jubilado: false },
      { pessoa_id: BRUNO, jubilado: false },
      { pessoa_id: DAVI, jubilado: true },
    ]
    assert.deepEqual(contarPlanos(planos, associados), { anual: 1, mensal: 1, pagantes: 2 })
  })

  it('quem não escolheu, ou escolheu o mês, paga por mês', () => {
    const planos = [{ pessoa_id: BRUNO, tipo: 'mensal' as const }]
    const associados = [
      { pessoa_id: ANA, jubilado: false },
      { pessoa_id: BRUNO, jubilado: false },
    ]
    assert.deepEqual(contarPlanos(planos, associados), { anual: 0, mensal: 2, pagantes: 2 })
  })

  it('o ano inteiro e o mês somam sempre os que pagam, mesmo com o plano repetido', () => {
    const planos = [
      { pessoa_id: ANA, tipo: 'anual' as const },
      { pessoa_id: ANA, tipo: 'anual' as const },
      { pessoa_id: CARLOS, tipo: 'anual' as const },
    ]
    const associados = [
      { pessoa_id: ANA, jubilado: false },
      { pessoa_id: CARLOS, jubilado: false },
    ]
    const r = contarPlanos(planos, associados)
    assert.deepEqual(r, { anual: 2, mensal: 0, pagantes: 2 })
    assert.equal(r.anual + r.mensal, r.pagantes)
  })

  it('sem associados, tudo zero', () => {
    assert.deepEqual(contarPlanos([{ pessoa_id: QUEM_SAIU, tipo: 'anual' }], []), { anual: 0, mensal: 0, pagantes: 0 })
  })
})
