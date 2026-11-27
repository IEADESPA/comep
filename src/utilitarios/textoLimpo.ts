// O texto sem o que não aparece: a mesma limpeza que o banco faz no nome e no telefone (interno.sem_invisiveis, na
// migração 20261125184044_seguranca_nome_e_telefone_limpos.sql). As telas limpam antes de mandar, para a pessoa ver
// na hora o que fica gravado. Os grupos, escritos pelo número de cada caractere:
//   controle e separador de linha (viram espaço); espaço diferente, como o espaço duro (vira espaço); o que não
//   aparece, como a largura zero, as marcas de direção e os preenchimentos (sai); acento empilhado (mais de dois
//   seguidos na mesma letra: fica com dois). Mudou aqui? Mude também a migração (e o teste dos dois).

// eslint-disable-next-line no-control-regex -- de propósito: achar o caractere de controle colado
const VIRA_ESPACO = /[\u0001-\u001f\u007f-\u009f\u2028\u2029\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]/gu
// eslint-disable-next-line no-misleading-character-class -- de propósito: achar o que não aparece
const NAO_APARECE = /[\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180b-\u180f\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u206f\u2800\u3164\ufe00-\ufe0f\ufeff\uffa0\ufff9-\ufffb\u{1d173}-\u{1d17a}\u{e0000}-\u{e007f}\u{e0100}-\u{e01ef}]/gu
// eslint-disable-next-line no-misleading-character-class -- de propósito: achar o acento solto empilhado
const ACENTO_EMPILHADO = /([\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f][\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f])[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f]+/gu

/** Os limites do cadastro da pessoa (os mesmos do banco). */
export const TAMANHO_DO_NOME = 150
export const TAMANHO_DO_TELEFONE = 40

/** Tira o que não aparece, junta os espaços e corta as pontas. */
export function semInvisiveis(texto: string): string {
  return texto
    .replace(VIRA_ESPACO, ' ')
    .replace(NAO_APARECE, '')
    .replace(ACENTO_EMPILHADO, '$1')
    .replace(/ {2,}/g, ' ')
    .trim()
}
