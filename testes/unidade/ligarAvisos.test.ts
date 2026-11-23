// O script que liga os avisos no celular (scripts/ligar-avisos.mjs): as travas e o formato das chaves.
// Revisão da parte 14 (23/11/2026), achado 4: sem trava para a produção nem para rodar de novo.
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  conferirArgumentos,
  gerarChaves,
  jaLigado,
  lerArgumentos,
  REF_PRODUCAO,
} from '../../scripts/ligar-avisos-regras.mjs'

const TESTE = 'abcdefghij0123456789'

describe('ligar os avisos no celular: as travas', () => {
  it('sem o projeto, ou com um projeto mal escrito, não faz nada', () => {
    assert.match(conferirArgumentos(lerArgumentos([])) ?? '', /Diga o projeto/)
    assert.match(conferirArgumentos(lerArgumentos(['--remote=curto'])) ?? '', /Diga o projeto/)
    assert.match(conferirArgumentos(lerArgumentos([`--remote=${TESTE}`, '--contato=http://inseguro'])) ?? '', /contato/)
    assert.equal(conferirArgumentos(lerArgumentos([`--remote=${TESTE}`])), null)
  })

  it('a produção só com --e-o-lancamento (a confirmação digitada vem depois)', () => {
    const semAviso = lerArgumentos([`--remote=${REF_PRODUCAO}`])
    assert.equal(semAviso.producao, true)
    assert.match(conferirArgumentos(semAviso) ?? '', /produção só no lançamento/)
    const noLancamento = lerArgumentos([`--remote=${REF_PRODUCAO}`, '--e-o-lancamento'])
    assert.equal(conferirArgumentos(noLancamento), null)
    assert.equal(lerArgumentos([`--remote=${TESTE}`]).producao, false)
  })

  it('rodar de novo (os Secrets já existem) só com --trocar-as-chaves', () => {
    const lista = 'NAME            | DIGEST\nVAPID_PUBLICA   | 1a2b...\nENVIO_SEGREDO   | 3c4d...\n'
    assert.equal(jaLigado(lista), true)
    assert.equal(jaLigado('NAME | DIGEST\nOUTRO_SEGREDO | 9f9f\n'), false)
    assert.equal(lerArgumentos([`--remote=${TESTE}`]).trocar, false)
    assert.equal(lerArgumentos([`--remote=${TESTE}`, '--trocar-as-chaves']).trocar, true)
  })
})

describe('ligar os avisos no celular: as chaves', () => {
  it('a pública tem 65 bytes (não comprimida, começa com 4), a privada 32 e o segredo 48 letras', () => {
    const { publica, privada, segredo } = gerarChaves()
    const bytes = (s: string) => Buffer.from(s, 'base64url')
    assert.equal(bytes(publica).length, 65)
    assert.equal(bytes(publica)[0], 4)
    assert.equal(bytes(privada).length, 32)
    assert.match(segredo, /^[A-Za-z0-9_-]{48}$/)
    // cada vez, chaves novas
    assert.notEqual(gerarChaves().segredo, segredo)
  })
})
