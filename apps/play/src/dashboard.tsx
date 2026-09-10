export type PlayerSession = Readonly<{
  avatarUrl: string | null;
  balance: number;
  id: string;
  name: string;
}>;

export function Dashboard({
  onLogout,
  session,
}: Readonly<{ onLogout: () => void; session: PlayerSession }>) {
  const initials = session.name.slice(0, 2).toUpperCase();
  return (
    <main className="app-shell">
      <header className="app-nav">
        <a className="brand" href="/" aria-label="FutHub, painel">
          <span aria-hidden="true" className="brand-ball" />
          FutHub
        </a>
        <nav aria-label="Navegação principal">
          <a className="is-active" href="#inicio">
            Início
          </a>
          <a href="#elenco">Elenco</a>
          <a href="#mercado">Mercado</a>
        </nav>
        <div className="player-menu">
          <span className="coins">◉ {session.balance.toLocaleString('pt-BR')}</span>
          {session.avatarUrl ? (
            <img alt="" className="avatar" height="40" src={session.avatarUrl} width="40" />
          ) : (
            <span className="avatar avatar-fallback">{initials}</span>
          )}
          <button onClick={onLogout} type="button">
            Sair
          </button>
        </div>
      </header>
      <section className="welcome" id="inicio" aria-labelledby="welcome-title">
        <div>
          <p className="kicker">CENTRO DE COMANDO</p>
          <h1 id="welcome-title">Boa noite, {session.name}.</h1>
          <p>Seu próximo capítulo começa no gramado.</p>
        </div>
        <div className="season-chip">
          <span /> Temporada 01
        </div>
      </section>
      <section className="dashboard-grid" aria-label="Resumo do clube">
        <article className="match-card">
          <p className="kicker">PARTIDA RANQUEADA</p>
          <h2>Pronto para jogar?</h2>
          <p>Encontre adversário e coloque seu elenco em campo.</p>
          <button className="play-button" type="button">
            Entrar na fila <span>→</span>
          </button>
          <div className="match-field" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
        </article>
        <article className="stat-card" id="elenco">
          <p>ELENCO</p>
          <strong>
            0 <small>cards</small>
          </strong>
          <span>Monte primeiro time</span>
          <span className="progress-track" aria-hidden="true">
            <i />
          </span>
        </article>
        <article className="stat-card" id="mercado">
          <p>MERCADO</p>
          <strong>Aberto</strong>
          <span>Novas oportunidades</span>
          <span className="progress-track is-ready" aria-hidden="true">
            <i />
          </span>
        </article>
        <article className="rank-card">
          <div>
            <p className="kicker">SUA DIVISÃO</p>
            <h2>Sem classificação</h2>
            <p>Jogue primeira ranqueada para entrar na liga.</p>
          </div>
          <div className="rank-emblem" aria-hidden="true">
            F
          </div>
        </article>
      </section>
    </main>
  );
}
