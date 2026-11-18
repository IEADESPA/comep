import { Icone } from '../../componentes/Icone'
import type { Pedido } from '../../dados/pedidos'
import { formatarData } from '../../utilitarios/formatos'

// Os três passos do pedido de associação (enviado, análise da secretaria, aprovação na assembleia),
// no Início de quem ainda não tem perfil e no "Meu pedido".

type Passo = { titulo: string; detalhe: string; estado: 'feito' | 'agora' | 'depois' }

function passosDoPedido(pedido: Pedido | null): Passo[] {
  const analise = 'Análise da secretaria'
  const assembleia = 'Aprovação na assembleia'
  if (!pedido || pedido.situacao === 'recusado' || pedido.situacao === 'desistiu') {
    return [
      { titulo: 'Fazer o pedido', detalhe: 'os seus dados e os documentos', estado: 'agora' },
      { titulo: analise, detalhe: 'depois do envio', estado: 'depois' },
      { titulo: assembleia, detalhe: 'na Assembleia Ordinária', estado: 'depois' },
    ]
  }
  const enviado = { titulo: 'Pedido enviado', detalhe: formatarData(pedido.enviado_em ?? pedido.criado_em), estado: 'feito' as const }
  if (pedido.situacao === 'enviado' || pedido.situacao === 'pendencia') {
    return [
      enviado,
      { titulo: analise, detalhe: pedido.situacao === 'pendencia' ? 'falta corrigir uma coisa' : 'em andamento', estado: 'agora' },
      { titulo: assembleia, detalhe: 'na próxima Assembleia Ordinária', estado: 'depois' },
    ]
  }
  return [
    enviado,
    { titulo: analise, detalhe: 'concluída', estado: 'feito' },
    {
      titulo: assembleia,
      detalhe:
        pedido.situacao === 'aprovado'
          ? 'aprovado'
          : pedido.assembleia_data
            ? `em ${formatarData(pedido.assembleia_data)}`
            : 'na próxima Assembleia Ordinária',
      estado: pedido.situacao === 'aprovado' ? 'feito' : 'agora',
    },
  ]
}

/** Os passos em linha (notebook) ou um embaixo do outro. */
export function PassosDoPedido({ pedido, emLinha = false }: { pedido: Pedido | null; emLinha?: boolean }) {
  return (
    <ol className={emLinha ? 'passos passos-linha' : 'passos'}>
      {passosDoPedido(pedido).map((p, i) => (
        <li key={p.titulo} className={`passo passo-${p.estado}`}>
          <span className="passo-bola" aria-hidden="true">
            {p.estado === 'feito' ? <Icone nome="check" tamanho={18} traco={3} /> : i + 1}
          </span>
          <span className="passo-texto">
            <strong>{p.titulo}</strong>
            <span>{p.detalhe}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}
