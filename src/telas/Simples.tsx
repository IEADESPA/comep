import { Link } from 'react-router'
import { Aviso } from '../componentes/Basicos'
import type { ItemMenu } from '../componentes/menu'

export function EmConstrucao({ item }: { item: ItemMenu }) {
  return (
    <>
      <h1>{item.titulo}</h1>
      <p>{item.descricao}</p>
      <p className="selo">Em construção — prevista para a Fase {item.fase}</p>
    </>
  )
}

export function NaoEncontrado() {
  return (
    <Aviso titulo="Página não encontrada">
      <p>
        Este endereço não existe no sistema. <Link to="/">Voltar ao início</Link>
      </p>
    </Aviso>
  )
}

export function ConfiguracaoAusente() {
  return (
    <main className="tela-entrada">
      <Aviso titulo="Configuração do banco ausente">
        <p>O app não sabe qual banco de dados usar.</p>
        <p className="detalhe">
          Equipe técnica: copie o arquivo .env.example para .env.local e preencha VITE_SUPABASE_URL e
          VITE_SUPABASE_PUBLISHABLE_KEY. Na publicação, essas informações vêm das variáveis do repositório no GitHub.
        </p>
      </Aviso>
    </main>
  )
}
