import { Link } from 'react-router'
import { Aviso, Carregando } from '../componentes/Basicos'
import { itensVisiveis } from '../componentes/menu'
import { NOME_DO_PERFIL } from '../dados/perfis'
import { useSessao } from '../estado/contexto'

export function Inicio() {
  const { estado, recarregarConta } = useSessao()

  if (estado.situacao !== 'logado' || estado.conta === null) {
    return <Carregando texto="Carregando o seu cadastro…" />
  }

  const resultado = estado.conta
  switch (resultado.tipo) {
    case 'banco_nao_preparado':
      return (
        <Aviso titulo="Banco de dados ainda não preparado">
          <p>As tabelas do sistema ainda não foram criadas neste projeto.</p>
          <p className="detalhe">Equipe técnica: aplicar as migrações da pasta supabase/migrations.</p>
        </Aviso>
      )
    case 'sem_cadastro':
      return (
        <Aviso titulo="Cadastro não encontrado">
          <p>
            O seu login ({estado.sessao.email ?? 'sem e-mail'}) ainda não está ligado a um cadastro no Conselho. Procure a
            secretaria.
          </p>
        </Aviso>
      )
    case 'erro':
      return (
        <Aviso titulo="Algo deu errado">
          <p>{resultado.mensagem}</p>
          <button type="button" className="botao" onClick={recarregarConta}>
            Tentar de novo
          </button>
        </Aviso>
      )
    case 'ok': {
      const { conta } = resultado
      const atalhos = itensVisiveis(conta.perfis).filter((item) => item.caminho !== '/painel')
      const primeiroNome = conta.nome.split(' ')[0]

      return (
        <>
          <h1>Olá, {primeiroNome}!</h1>

          {conta.perfis.length > 0 ? (
            <ul className="perfis" aria-label="Seus perfis">
              {conta.perfis.map((perfil) => (
                <li key={perfil}>{NOME_DO_PERFIL[perfil]}</li>
              ))}
            </ul>
          ) : (
            <div className="aviso-sem-perfil">
              <p className="detalhe">Nenhum perfil foi atribuído a você ainda.</p>
              <p>
                Quer se associar ao COMEP? <Link to="/meu-pedido">Faça ou acompanhe o seu pedido de associação</Link>.
              </p>
              <p className="detalhe">
                Já é associado? Peça à secretaria um código de primeiro acesso para ligar este login ao seu cadastro.
              </p>
            </div>
          )}

          <div className="atalhos">
            {atalhos.map((item) => (
              <Link key={item.caminho} to={item.caminho} className="cartao">
                <strong>{item.titulo}</strong>
                <span>{item.descricao}</span>
                {!item.pronto && <span className="selo">Fase {item.fase}</span>}
              </Link>
            ))}
          </div>
        </>
      )
    }
  }
}
