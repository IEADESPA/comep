import { Link } from 'react-router'
import { Ladrilho } from '../../componentes/Icone'
import { modulosDoInicio, type ModuloNoInicio } from '../../componentes/menu'
import { Carregando } from '../../componentes/Basicos'
import type { Perfil } from '../../dados/perfis'
import { useSessao } from '../../estado/contexto'

// Os módulos ficam na página inicial (o menu da esquerda é curto). No notebook, em cartões por assunto;
// no celular, numa grade de ícones (com "Ver todos" quando não cabem).

const NO_CELULAR = 9

/** Os módulos da pessoa: grupos por assunto (notebook) e a grade (celular). */
export function SecaoModulos({ perfis, todosNoCelular = false }: { perfis: readonly Perfil[]; todosNoCelular?: boolean }) {
  const { grupos, administracao } = modulosDoInicio(perfis)
  if (grupos.length === 0) return null
  const todos: ModuloNoInicio[] = [...grupos.flatMap((g) => g.modulos), ...administracao]
  const naGrade = todosNoCelular ? todos : todos.slice(0, NO_CELULAR)

  return (
    <section className="secao-modulos" aria-labelledby="titulo-modulos">
      <div className="cabecalho-modulos">
        <h2 id="titulo-modulos" className={todosNoCelular ? 'somente-leitor' : 'so-celular'}>
          Módulos
        </h2>
        {!todosNoCelular && todos.length > NO_CELULAR && (
          <Link to="/modulos" className="link-forte so-celular">
            Ver todos ({todos.length})
          </Link>
        )}
      </div>

      <div className="grupos-modulos so-computador">
        {grupos.map((g) => (
          <div key={g.titulo} className="bloco grupo-modulos">
            <h3 className="rotulo">{g.titulo}</h3>
            <ul>
              {g.modulos.map((m) => (
                <li key={m.caminho}>
                  <Link to={m.caminho} className="modulo-link">
                    <Ladrilho area={m.area} icone={m.icone} tamanho={32} />
                    <span>{m.titulo}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {administracao.length > 0 && (
        <p className="inicio-administracao so-computador">
          Administração:{' '}
          {administracao.map((m, i) => (
            <span key={m.caminho}>
              {i > 0 && ' · '}
              <Link to={m.caminho}>{m.titulo}</Link>
            </span>
          ))}
        </p>
      )}

      <ul className="grade-modulos so-celular">
        {naGrade.map((m) => (
          <li key={m.caminho}>
            <Link to={m.caminho} aria-label={m.titulo}>
              <Ladrilho area={m.area} icone={m.icone} tamanho={42} />
              <span aria-hidden="true">{m.curto}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** /modulos — todos os módulos (no celular, é a aba "Módulos" da barra de cima). */
export function Modulos() {
  const { estado } = useSessao()
  if (estado.situacao !== 'logado' || estado.conta?.tipo !== 'ok') return <Carregando />
  const { perfis } = estado.conta.conta
  return (
    <div className="inicio">
      <div className="inicio-cabecalho">
        <h1>Módulos</h1>
        <p className="inicio-data">Tudo o que você pode abrir no sistema, por assunto.</p>
      </div>
      {modulosDoInicio(perfis).grupos.length === 0 ? (
        <p className="vazio">Nenhum módulo ainda: o acesso aparece depois que a secretaria ligar o seu cadastro.</p>
      ) : (
        <SecaoModulos perfis={perfis} todosNoCelular />
      )}
    </div>
  )
}
