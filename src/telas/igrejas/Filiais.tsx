import { useState } from 'react'
import { Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { BotaoConfirmarNaLinha } from '../../componentes/Basicos'
import { Chip } from '../../componentes/Telas'
import type { ItemLista } from '../../dados/configuracoes'
import {
  arquivarFilial,
  listarFiliais,
  NOME_DO_TIPO_FILIAL,
  PLURAL_DO_TIPO_FILIAL,
  salvarFilial,
  type Filial,
  type TipoFilial,
} from '../../dados/igrejas'
import { useCarregar } from '../../estado/useCarregar'
import { useUmaVez } from '../../estado/useUmaVez'
import { coordenadasDoLink } from '../../utilitarios/regularizacao'
import type { OpcaoMinistro } from './regras'

// As filiais da igreja (aprovado na rodada 12, 18/11/2026: opção 2, os cartões): congregações, pontos de culto e
// células, numa gestão simples. Sem lista de membros; a filial usa o CNPJ e os documentos da matriz. O responsável é
// SÓ ministro associado da igreja (se não houver, fica sem responsável). A localização é opcional: o link do Google
// Maps vira a latitude e a longitude (o mapa em si fica para depois).

const AREA_DO_TIPO: Record<TipoFilial, 'pessoas' | 'eventos' | 'financas'> = { congregacao: 'pessoas', ponto_de_culto: 'eventos', celula: 'financas' }
const TIPOS = Object.keys(NOME_DO_TIPO_FILIAL) as TipoFilial[]

export function FiliaisDaIgreja({
  igrejaId,
  ministros,
  bairros,
  podeMudar,
}: {
  igrejaId: string
  ministros: OpcaoMinistro[]
  bairros: ItemLista[]
  podeMudar: boolean
}) {
  const [carga, recarregar] = useCarregar(() => listarFiliais(igrejaId))
  const [filtro, setFiltro] = useState<TipoFilial | 'todas'>('todas')
  const [editando, setEditando] = useState<Filial | 'nova' | null>(null)
  const [retorno, setRetorno] = useState<{ sucesso?: string; erro?: string }>({})
  const nomeDe = (id: string | null) => (id ? (ministros.find((m) => m.pessoa_id === id)?.nome ?? 'ministro associado') : 'sem responsável')
  return (
    <section className="aba-conteudo" aria-labelledby="titulo-filiais">
      <h2 id="titulo-filiais" className="somente-leitor">
        Filiais
      </h2>
      <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(filiais) => (
          <>
            <div className="busca-com-acao">
              <div className="pilulas" role="group" aria-label="Mostrar as filiais">
                <button type="button" className={filtro === 'todas' ? 'pilula ativa' : 'pilula'} aria-pressed={filtro === 'todas'} onClick={() => setFiltro('todas')}>
                  Todas <strong>{filiais.length}</strong>
                </button>
                {TIPOS.map((t) => (
                  <button key={t} type="button" className={filtro === t ? 'pilula ativa' : 'pilula'} aria-pressed={filtro === t} onClick={() => setFiltro(t)}>
                    {PLURAL_DO_TIPO_FILIAL[t]} <strong>{filiais.filter((f) => f.tipo === t).length}</strong>
                  </button>
                ))}
              </div>
              {podeMudar && editando === null && (
                <button type="button" className="botao" onClick={() => setEditando('nova')}>
                  + Nova filial
                </button>
              )}
            </div>
            {editando !== null && (
              <FormFilial
                igrejaId={igrejaId}
                filial={editando === 'nova' ? null : editando}
                ministros={ministros}
                bairros={bairros}
                aoFechar={() => setEditando(null)}
                aoConcluir={(r, sucesso) => {
                  setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso })
                  if (r.erro === null) {
                    setEditando(null)
                    recarregar()
                  }
                }}
              />
            )}
            {filiais.length === 0 ? (
              <p className="vazio">Nenhuma filial cadastrada.</p>
            ) : (
              <ul className="cartoes-filiais" aria-label="Filiais da igreja">
                {filiais
                  .filter((f) => filtro === 'todas' || f.tipo === filtro)
                  .map((f) => (
                    <li key={f.id} className="bloco" aria-label={f.nome}>
                      <span>
                        <Chip area={AREA_DO_TIPO[f.tipo]}>{NOME_DO_TIPO_FILIAL[f.tipo]}</Chip>
                      </span>
                      <strong>{f.nome}</strong>
                      <dl className="definicoes">
                        <dt>Bairro</dt>
                        <dd>{f.bairro?.nome ?? '—'}</dd>
                        <dt>Responsável</dt>
                        <dd>{nomeDe(f.responsavel_id)}</dd>
                      </dl>
                      {f.latitude !== null && f.longitude !== null && (
                        <a href={`https://www.google.com/maps?q=${f.latitude},${f.longitude}`} target="_blank" rel="noreferrer">
                          Ver no mapa
                        </a>
                      )}
                      {podeMudar && (
                        <span className="acoes-item">
                          <button type="button" className="botao-link" onClick={() => setEditando(f)}>
                            Editar
                          </button>
                          <ArquivarFilial
                            filial={f}
                            aoConcluir={(r) => {
                              setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso: `${f.nome}: arquivada.` })
                              if (r.erro === null) recarregar()
                            }}
                          />
                        </span>
                      )}
                    </li>
                  ))}
              </ul>
            )}
            <p className="detalhe">
              Sem lista de membros. A filial usa o CNPJ e os documentos da igreja (a congregação com templo próprio também), e não entra
              sozinha no COMEP. O responsável é ministro associado da igreja; se não houver, fica sem responsável.
            </p>
          </>
        )}
      </MostrarCarga>
    </section>
  )
}

function ArquivarFilial({ filial, aoConcluir }: { filial: Filial; aoConcluir: (r: { erro: string | null }) => void }) {
  const [enviando, umaVez] = useUmaVez()
  return (
    <BotaoConfirmarNaLinha
      texto="Arquivar"
      confirmar={`Confirmar: arquivar ${filial.nome}`}
      desabilitado={enviando}
      aoConfirmar={() => void umaVez(async () => aoConcluir(await arquivarFilial(filial.id)))}
    />
  )
}

function FormFilial({
  igrejaId,
  filial,
  ministros,
  bairros,
  aoFechar,
  aoConcluir,
}: {
  igrejaId: string
  filial: Filial | null
  ministros: OpcaoMinistro[]
  bairros: ItemLista[]
  aoFechar: () => void
  aoConcluir: (r: { erro: string | null }, sucesso: string) => void
}) {
  const [tipo, setTipo] = useState<TipoFilial>(filial?.tipo ?? 'congregacao')
  const [nome, setNome] = useState(filial?.nome ?? '')
  const [bairro, setBairro] = useState(filial?.bairro_id ?? '')
  const [responsavel, setResponsavel] = useState(filial?.responsavel_id ?? '')
  const [link, setLink] = useState(filial?.latitude != null ? `${filial.latitude}, ${filial.longitude}` : '')
  const [enviando, umaVez] = useUmaVez()
  const local = link.trim() ? coordenadasDoLink(link) : null
  return (
    <form
      className="bloco"
      aria-label={filial ? `Editar: ${filial.nome}` : 'Nova filial'}
      onSubmit={(e) => {
        e.preventDefault()
        void umaVez(async () => {
          const r = await salvarFilial(filial?.id ?? null, igrejaId, {
            tipo,
            nome: nome.trim(),
            bairro_id: bairro || null,
            responsavel_id: responsavel || null,
            latitude: local?.latitude ?? null,
            longitude: local?.longitude ?? null,
          })
          aoConcluir(r, filial ? `${nome.trim()}: salva.` : `${nome.trim()}: filial cadastrada.`)
        })
      }}
    >
      <h3>{filial ? 'Editar a filial' : 'Nova filial'}</h3>
      <div className="grade-form">
        <label>
          Tipo
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoFilial)}>
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {NOME_DO_TIPO_FILIAL[t]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Nome da filial *
          <input required minLength={3} maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Congregação Bairro da Paz" />
        </label>
        <label>
          Bairro
          <select value={bairro} onChange={(e) => setBairro(e.target.value)}>
            <option value="">— Escolha o bairro —</option>
            {bairros.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nome}
              </option>
            ))}
          </select>
        </label>
        <label>
          Responsável (ministro associado da igreja)
          <select value={responsavel} onChange={(e) => setResponsavel(e.target.value)}>
            <option value="">— Sem responsável —</option>
            {ministros.map((m) => (
              <option key={m.pessoa_id} value={m.pessoa_id}>
                {m.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="largura-total">
          Localização (opcional): cole o link do Google Maps
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://www.google.com/maps/…@-6.0679,-49.9022…" />
        </label>
        <p className={link.trim() && !local ? 'aviso-campo largura-total' : 'detalhe largura-total'}>
          {link.trim()
            ? local
              ? `Localização: ${local.latitude.toLocaleString('pt-BR')}, ${local.longitude.toLocaleString('pt-BR')}.`
              : 'Não achei a localização neste link. No Google Maps, abra o lugar e copie o endereço da barra do navegador (o link curto não traz as coordenadas).'
            : 'Só o bairro e o ponto no mapa; nada de rua. O mapa da cidade com as filiais vem depois.'}
        </p>
      </div>
      <div className="acoes">
        <button type="submit" className="botao" disabled={enviando || (link.trim() !== '' && !local)}>
          {filial ? 'Salvar' : 'Adicionar a filial'}
        </button>
        <button type="button" className="botao botao-secundario" onClick={aoFechar}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
