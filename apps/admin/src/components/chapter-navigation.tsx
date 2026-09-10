import { Link, NavLink, useLocation } from 'react-router-dom';

const chapters = [
  { label: 'Visão geral', to: '/app', links: [] },
  {
    label: 'Acervo',
    to: '/app/gerenciar/cards',
    links: [
      { label: 'Em destaque', to: '/app/gerenciar/cards' },
      { label: 'Todos os cards', to: '/app/gerenciar/jogadores' },
      { label: 'Coleções', to: '/app/gerenciar/colecoes' },
      { label: 'Times', to: '/app/gerenciar/times' },
    ],
  },
  { label: 'Packs', to: '/app/gerenciar/packs', links: [] },
  {
    label: 'Studio',
    to: '/app/studio',
    links: [
      { label: 'Studio de cards', to: '/app/studio' },
      { label: 'Studio de packs', to: '/app/studio/packs' },
    ],
  },
  {
    label: 'Operação',
    to: '/app/comandos',
    links: [
      { label: 'Comandos', to: '/app/comandos' },
      { label: 'Economia', to: '/app/comandos/lucro' },
      { label: 'Respostas do bot', to: '/app/respostas' },
      { label: 'Assistente IA', to: '/app/assistente' },
    ],
  },
] as const;

export function ChapterNavigation() {
  const { pathname } = useLocation();
  const active =
    chapters.find(
      (chapter) => chapter.to === pathname || chapter.links.some((link) => link.to === pathname),
    ) ?? chapters[0];

  return (
    <>
      <nav className="futhub-chapters" aria-label="Capítulos do FutHub">
        {chapters.map((chapter, index) => (
          <Link
            key={chapter.to}
            to={chapter.to}
            aria-current={chapter === active ? 'page' : undefined}
            className={chapter === active ? 'is-current' : ''}
          >
            <span aria-hidden="true">0{index + 1}</span>
            {chapter.label}
          </Link>
        ))}
        <span className="futhub-edition">FUTEBOL. EM COLEÇÃO.</span>
      </nav>
      {active.links.length > 0 && (
        <nav className="futhub-subnav" aria-label={`Navegação de ${active.label}`}>
          {active.links.map((link) => (
            <NavLink key={link.to} end to={link.to}>
              {link.label}
            </NavLink>
          ))}
        </nav>
      )}
    </>
  );
}
