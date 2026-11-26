import { useState } from 'react'
import { gerarCodigo, type FinalidadeCodigo } from '../dados/codigos'
import { Mensagem } from './Basicos'

/**
 * Gera o código de primeiro acesso (quem ainda não tem login) ou de nova senha (quem já tem).
 * O código aparece uma única vez, para a secretaria mandar pelo WhatsApp. Vale por 7 dias.
 */
export function GerarCodigo({
  pessoaId,
  nome,
  temLogin,
  telefone,
}: {
  pessoaId: string
  nome: string
  temLogin: boolean
  telefone?: string | null
}) {
  const finalidade: FinalidadeCodigo = temLogin ? 'nova_senha' : 'primeiro_acesso'
  const [codigo, setCodigo] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const pagina = temLogin ? 'nova-senha' : 'primeiro-acesso'
  const endereco = `${window.location.origin}${import.meta.env.BASE_URL}${pagina}`
  const texto = codigo
    ? temLogin
      ? `COMEP — código para criar uma nova senha: ${codigo} (vale por 7 dias). Acesse ${endereco}`
      : `COMEP — seu código de primeiro acesso ao Portal do membro: ${codigo} (vale por 7 dias). Acesse ${endereco} e crie a sua senha. Se já criou uma conta pelo site, entre com ela e use o código em "Tenho um código", no Início.`
    : ''
  const numero = (telefone ?? '').replace(/\D/g, '')
  const whatsapp = `https://wa.me/${numero.length >= 10 ? (numero.length <= 11 ? `55${numero}` : numero) : ''}?text=${encodeURIComponent(texto)}`

  async function gerar() {
    setEnviando(true)
    setCopiado(false)
    const r = await gerarCodigo(pessoaId, finalidade)
    setEnviando(false)
    if (r.erro !== null) {
      setErro(r.erro)
      return
    }
    setErro(null)
    setCodigo(r.dados)
  }

  return (
    <div className="gerar-codigo">
      <button type="button" className="botao botao-secundario" disabled={enviando} onClick={() => void gerar()}>
        {temLogin ? 'Gerar código para nova senha' : 'Gerar código de primeiro acesso'}
      </button>
      <Mensagem erro={erro} />
      {codigo && (
        <div className="codigo-gerado" role="status" aria-label={`Código gerado para ${nome}`}>
          <p>
            Código para <strong>{nome}</strong> (vale por 7 dias; gerar outro cancela este):
          </p>
          <p className="codigo">{codigo}</p>
          <div className="acoes">
            <button
              type="button"
              className="botao botao-secundario"
              onClick={async () => {
                await navigator.clipboard.writeText(texto)
                setCopiado(true)
              }}
            >
              {copiado ? 'Mensagem copiada' : 'Copiar mensagem'}
            </button>
            <a className="botao" href={whatsapp} target="_blank" rel="noreferrer">
              Enviar pelo WhatsApp
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
