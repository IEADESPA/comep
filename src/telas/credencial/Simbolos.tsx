// Credenciais › Símbolos (Fase 5.5, parte 8; rodada 11, simbolos-2 "a biblioteca", aprovada).
// Os gerais da fé, os de cada tradição (não são só 6: as denominações grandes também) e os logotipos das
// denominações. O logotipo oficial é de cada denominação: a secretaria envia o arquivo que a própria denominação
// fornecer, com a autorização dela. O sistema não copia logotipos da internet.
import { useState } from 'react'
import { Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { Icone } from '../../componentes/Icone'
import { CabecalhoFuncao } from '../../componentes/MenuDoModulo'
import { NOME_DA_TRADICAO, type Tradicao } from '../../dados/cadastros'
import {
  enviarImagemModelo,
  enviarLogotipoDenominacao,
  logotiposDasDenominacoes,
  urlImagemModelo,
  type LogotipoDenominacao,
} from '../../dados/credencial'
import { useCarregar } from '../../estado/useCarregar'
import { useUmaVez } from '../../estado/useUmaVez'
import { formatarDataDeInstante } from '../../utilitarios/formatos'
import { prepararImagemModelo } from '../../utilitarios/imagens'
import { GERAIS, POR_TRADICAO, SIMBOLOS, type ChaveSimbolo } from '../../utilitarios/simbolos'

type Retorno = { sucesso?: string; erro?: string }

function Desenho({ chave, tamanho = 26 }: { chave: ChaveSimbolo; tamanho?: number }) {
  const s = SIMBOLOS[chave]
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {'cheio' in s && s.cheio ? (
        <path d={s.d} fill="currentColor" />
      ) : (
        <path d={s.d} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  )
}

export function BibliotecaDeSimbolos() {
  const [busca, setBusca] = useState('')
  const [retorno, setRetorno] = useState<Retorno>({})
  const termo = busca.trim().toLocaleLowerCase('pt-BR')
  const serve = (k: ChaveSimbolo) => !termo || SIMBOLOS[k].nome.toLocaleLowerCase('pt-BR').includes(termo)
  const grupos = POR_TRADICAO.filter((g) => !termo || g.simbolos.some(serve) || g.nome.toLocaleLowerCase('pt-BR').includes(termo))
  return (
    <div className="tela-nova">
      <CabecalhoFuncao
        modulo="Credenciais"
        titulo="Biblioteca de símbolos"
        sub="Desenhos do próprio sistema, nunca emojis; os logotipos, só os que a denominação fornecer"
        acoes={
          <label className="campo-busca">
            <Icone nome="busca" tamanho={18} />
            <input type="search" aria-label="Buscar símbolo" placeholder="Buscar símbolo" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </label>
        }
      />
      <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
      <div className="biblioteca-simbolos">
        <div className="biblioteca-coluna">
          <section className="painel" aria-labelledby="titulo-gerais">
            <div className="titulo-com-acao">
              <h2 id="titulo-gerais">Gerais da fé</h2>
              <span className="detalhe">{GERAIS.length} símbolos, para qualquer modelo</span>
            </div>
            <ul className="grade-simbolos-pagina" aria-label="Gerais da fé">
              {GERAIS.filter(serve).map((k) => (
                <li key={k}>
                  <Desenho chave={k} />
                  <span>{SIMBOLOS[k].nome}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="painel" aria-labelledby="titulo-tradicoes">
            <h2 id="titulo-tradicoes">Por tradição</h2>
            <ul className="tradicoes" aria-label="Por tradição">
              {grupos.map((g) => (
                <li key={g.chave} aria-label={g.nome}>
                  <span className="tradicao-nome">
                    <strong>{g.nome}</strong>
                    <span className="detalhe">{g.exemplos}</span>
                  </span>
                  <span className="tradicao-simbolos">
                    {g.simbolos.map((k) => (
                      <span key={k} title={SIMBOLOS[k].nome} className="tradicao-simbolo">
                        <Desenho chave={k} tamanho={20} />
                        <span className="somente-leitor">{SIMBOLOS[k].nome}</span>
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
            <p className="detalhe">No editor do modelo, os símbolos ficam em "Símbolos": a cor, o tamanho e o traço mudam à vontade.</p>
          </section>
        </div>
        <Logotipos aoMudar={setRetorno} />
      </div>
    </div>
  )
}

function Logotipos({ aoMudar }: { aoMudar: (r: Retorno) => void }) {
  const [carga, recarregar] = useCarregar(logotiposDasDenominacoes)
  return (
    <section className="painel" aria-labelledby="titulo-logotipos">
      <h2 id="titulo-logotipos">Logotipos das denominações</h2>
      <p className="detalhe">
        O logotipo oficial é de cada denominação: a secretaria envia o arquivo que a própria denominação fornecer, com a
        autorização dela. O sistema não copia logotipos da internet.
      </p>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(lista) =>
          lista.length === 0 ? (
            <p className="vazio">Nenhuma denominação cadastrada (Igrejas › Denominações).</p>
          ) : (
            <ul className="lista-logotipos" aria-label="Logotipos das denominações">
              {lista.map((d) => (
                <li key={d.id} aria-label={d.nome}>
                  <LinhaLogotipo
                    d={d}
                    aoMudar={(r) => {
                      aoMudar(r)
                      if (r.sucesso) recarregar()
                    }}
                  />
                </li>
              ))}
            </ul>
          )
        }
      </MostrarCarga>
    </section>
  )
}

function LinhaLogotipo({ d, aoMudar }: { d: LogotipoDenominacao; aoMudar: (r: Retorno) => void }) {
  const [enviando, umaVez] = useUmaVez()
  return (
    <>
      {d.logotipo ? (
        <img className="logotipo-miniatura" src={urlImagemModelo(d.logotipo)} alt={`Logotipo de ${d.nome}`} />
      ) : (
        <span className="logotipo-miniatura logotipo-vazio" aria-hidden="true">
          +
        </span>
      )}
      <span className="logotipo-texto">
        <strong>{d.nome}</strong>
        <span className="detalhe">
          {d.tradicao ? `${NOME_DA_TRADICAO[d.tradicao as Tradicao] ?? d.tradicao} · ` : ''}
          {d.logotipo && d.logotipo_em ? `enviado em ${formatarDataDeInstante(d.logotipo_em)}` : 'falta enviar'}
        </span>
      </span>
      <label className="botao-texto botao-arquivo">
        {enviando ? 'Enviando…' : d.logotipo ? 'Trocar' : 'Enviar'}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="somente-leitor"
          aria-label={`${d.logotipo ? 'Trocar' : 'Enviar'} o logotipo de ${d.nome}`}
          disabled={enviando}
          onChange={(ev) => {
            const arquivo = ev.target.files?.[0]
            ev.target.value = ''
            if (!arquivo) return
            void umaVez(async () => {
              const pronto = await prepararImagemModelo(arquivo)
              if ('erro' in pronto) return aoMudar({ erro: pronto.erro })
              const r = await enviarImagemModelo(pronto.blob, pronto.extensao)
              if (r.erro !== null) return aoMudar({ erro: r.erro })
              const ligado = await enviarLogotipoDenominacao(d.id, r.dados)
              aoMudar(ligado.erro !== null ? { erro: ligado.erro } : { sucesso: `Logotipo de ${d.nome} enviado.` })
            })
          }}
        />
      </label>
    </>
  )
}
