import {
  ApiClientError,
  deleteV1AdminSession,
  getV1AdminLucro,
  getV1AdminSession,
  postV1AdminSession,
} from '@futhub/api-client';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { NavLink, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import { adminApiOptions } from './api/admin-client';
import { Cards } from './features/cards/cards';
import { Studio } from './features/studio/studio';
import { LucroPage } from './pages/lucro-page';
import type { LucroConfig, LucroReward } from './lib/lucro';

type Theme = 'light' | 'dark';

function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
  );
  const nextTheme = theme === 'dark' ? 'light' : 'dark';

  function toggleTheme() {
    document.documentElement.dataset.theme = nextTheme;
    try {
      window.localStorage.setItem('futhub-theme', nextTheme);
    } catch {
      // Storage can be unavailable in privacy-restricted browsing contexts.
    }
    setTheme(nextTheme);
  }

  return (
    <button
      aria-label={`Ativar modo ${nextTheme === 'dark' ? 'escuro' : 'claro'}`}
      aria-pressed={theme === 'dark'}
      className="theme-toggle"
      onClick={toggleTheme}
      type="button"
    >
      Tema {nextTheme === 'dark' ? 'escuro' : 'claro'}
    </button>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireSession />}>
        <Route element={<AdminLayout />}>
          <Route path="/app/comandos" element={<CommandsPage />} />
          <Route path="/app/comandos/lucro" element={<LucroPage />} />
          <Route path="/app/gerenciar/cards" element={<Cards />} />
          <Route path="/app/studio" element={<Studio />} />
        </Route>
      </Route>
      <Route path="/" element={<Navigate replace to="/app/comandos/lucro" />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

function RequireSession() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    void getV1AdminSession(adminApiOptions())
      .then(() => {
        if (active) setAuthorized(true);
      })
      .catch(() => {
        if (active) setAuthorized(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (authorized === null) return null;
  return authorized ? <Outlet /> : <Navigate replace to="/login" />;
}

function LoginPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    const apiKey = form.get('apiKey');
    if (typeof apiKey !== 'string') {
      setError('Informe uma API key.');
      setPending(false);
      return;
    }
    try {
      await postV1AdminSession({ apiKey }, adminApiOptions());
      navigate('/app/comandos');
    } catch (cause) {
      setError(cause instanceof ApiClientError ? cause.message : 'Não foi possível autenticar.');
      setPending(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-hero" aria-labelledby="login-title">
        <div className="login-brand-row">
          <div className="brand-lockup" aria-label="FutHub">
            <span className="brand-mark" aria-hidden="true" />
            <strong>FutHub</strong>
          </div>
          <ThemeToggle />
        </div>
        <div>
          <p className="eyebrow">Controle operacional</p>
          <h2 id="login-title">Economia precisa de decisões claras.</h2>
          <p>Configure recompensas, chance e intervalo do comando de lucro sem expor credencial.</p>
        </div>
      </section>
      <form className="login-card" onSubmit={submit}>
        <p className="eyebrow">Acesso restrito</p>
        <h1>FutHub Admin</h1>
        <p className="intro">Use API key para operar configurações do jogo.</p>
        <label htmlFor="apiKey">API key</label>
        <input
          autoComplete="current-password"
          id="apiKey"
          name="apiKey"
          placeholder="Cole sua chave de acesso"
          required
          type="password"
        />
        {error ? <p className="form-error">{error}</p> : null}
        <button className="button-primary" disabled={pending} type="submit">
          {pending ? 'Validando…' : 'Entrar no painel'}
        </button>
        <p className="form-note">A chave fica somente em cookie de sessão HTTP-only.</p>
      </form>
    </main>
  );
}

function AdminLayout() {
  const navigate = useNavigate();

  async function logout() {
    await deleteV1AdminSession(adminApiOptions()).catch(() => undefined);
    navigate('/login');
  }

  return (
    <main className="admin-shell">
      <header className="top-nav">
        <NavLink className="brand-lockup" to="/app/comandos">
          <span className="brand-mark" aria-hidden="true" />
          <strong>FutHub</strong>
          <span className="brand-divider" />
          <span>Admin</span>
        </NavLink>
        <nav className="admin-section-tabs" aria-label="Área administrativa">
          <NavLink to="/app/comandos">Comandos</NavLink>
          <NavLink to="/app/gerenciar/cards">Gerenciamento</NavLink>
          <NavLink to="/app/studio">Studio</NavLink>
        </nav>
        <div className="nav-actions">
          <ThemeToggle />
          <span className="session-state">API key ativa</span>
          <button className="logout-button" onClick={() => void logout()} type="button">
            Sair
          </button>
        </div>
      </header>
      <div className="admin-workspace">
        <Outlet />
      </div>
    </main>
  );
}

type CommandCategory = 'Todos' | 'Economia' | 'Futebol' | 'Cards' | 'Administração';
type CommandModule = Readonly<{
  category: Exclude<CommandCategory, 'Todos'>;
  description: string;
  glyph: string;
  name: string;
  status: 'active' | 'disabled';
}>;

const commandCategories: readonly CommandCategory[] = [
  'Todos',
  'Economia',
  'Futebol',
  'Cards',
  'Administração',
];
const commandModules: readonly CommandModule[] = [
  {
    category: 'Economia',
    description: 'Recompensas periódicas, chances e mensagens para movimentar a economia.',
    glyph: '₣',
    name: '/lucro',
    status: 'active',
  },
  {
    category: 'Futebol',
    description: 'Consulta de elenco, formação e identidade do time do jogador.',
    glyph: '⚽',
    name: '/time',
    status: 'disabled',
  },
  {
    category: 'Cards',
    description: 'Coleção, progresso e apresentação dos cards conquistados.',
    glyph: '◆',
    name: '/coleção',
    status: 'disabled',
  },
  {
    category: 'Administração',
    description: 'Ajustes rápidos do servidor e permissões operacionais do bot.',
    glyph: '⌘',
    name: '/config',
    status: 'disabled',
  },
];

function commandDuration(seconds: number): string {
  if (seconds >= 3600 && seconds % 3600 === 0) return `${seconds / 3600} h`;
  if (seconds >= 60 && seconds % 60 === 0) return `${seconds / 60} min`;
  return `${seconds} s`;
}

function chooseReward(rewards: readonly LucroReward[]): LucroReward | null {
  const totalWeight = rewards.reduce((total, reward) => total + reward.weight, 0);
  if (totalWeight <= 0) return rewards[0] ?? null;

  let position = Math.random() * totalWeight;
  for (const reward of rewards) {
    position -= reward.weight;
    if (position < 0) return reward;
  }
  return rewards.at(-1) ?? null;
}

function previewText(config: LucroConfig, reward: LucroReward): string {
  const values: Record<string, string> = {
    '{availableAt}': 'em 10 minutos',
    '{balance}': '2.850',
    '{level}': '12',
    '{message}': reward.messages.pt,
    '{nextLevelXp}': '400',
    '{reward}': String(reward.value),
    '{xp}': '120',
  };
  return Object.entries(values).reduce(
    (text, [token, value]) => text.replaceAll(token, value),
    config.embed.description,
  );
}
function renderDiscordMarkdown(text: string) {
  const occurrences = new Map<string, number>();
  return text
    .replaceAll('\\n', '\n')
    .split(/(\*\*[^*]+\*\*|\n)/g)
    .map((part) => {
      const occurrence = occurrences.get(part) ?? 0;
      occurrences.set(part, occurrence + 1);
      const key = `${part}-${occurrence}`;
      if (part === '\n') return <br key={key} />;
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={key}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
}

function CommandsPage() {
  const navigate = useNavigate();
  const searchRef = useRef<HTMLInputElement>(null);
  const paletteDialogRef = useRef<HTMLDialogElement>(null);
  const previewDialogRef = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CommandCategory>('Todos');
  const [config, setConfig] = useState<LucroConfig | null>(null);
  const [configState, setConfigState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [paletteQuery, setPaletteQuery] = useState('');
  const [previewReward, setPreviewReward] = useState<LucroReward | null>(null);

  useEffect(() => {
    let active = true;
    void getV1AdminLucro(adminApiOptions())
      .then((response) => {
        if (!active) return;
        setConfig(response as LucroConfig);
        setConfigState('ready');
      })
      .catch(() => {
        if (active) setConfigState('error');
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function openPalette(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteQuery('');
        if (!paletteDialogRef.current?.open) paletteDialogRef.current?.showModal();
      }
    }
    window.addEventListener('keydown', openPalette);
    return () => window.removeEventListener('keydown', openPalette);
  }, []);

  const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR');
  const visibleCommands = commandModules.filter(
    (command) =>
      (category === 'Todos' || command.category === category) &&
      (!normalizedQuery ||
        `${command.name} ${command.category} ${command.description}`
          .toLocaleLowerCase('pt-BR')
          .includes(normalizedQuery)),
  );
  const currentReward = previewReward ?? config?.rewards[0] ?? null;
  const renderedPreview = config && currentReward ? previewText(config, currentReward) : '';

  function openPreview(): void {
    if (!config) return;
    setPreviewReward(chooseReward(config.rewards));
    if (!previewDialogRef.current?.open) previewDialogRef.current?.showModal();
  }

  function focusCommandSearch(): void {
    paletteDialogRef.current?.close();
    window.requestAnimationFrame(() => searchRef.current?.focus());
  }

  const paletteActions = [
    {
      category: 'Economia',
      detail: 'Cooldown, lucros e embed',
      label: 'Configurar /lucro',
      run: () => navigate('/app/comandos/lucro'),
    },
    {
      category: 'Teste',
      detail: 'Simular a resposta salva no Discord',
      label: 'Testar /lucro',
      run: () => {
        paletteDialogRef.current?.close();
        openPreview();
      },
    },
    {
      category: 'Navegação',
      detail: 'Filtrar o diretório de comandos',
      label: 'Buscar comandos',
      run: focusCommandSearch,
    },
    {
      category: 'Produção visual',
      detail: 'Abrir o editor de cards',
      label: 'Abrir Studio',
      run: () => navigate('/app/studio'),
    },
  ].filter((action) =>
    `${action.label} ${action.category} ${action.detail}`
      .toLocaleLowerCase('pt-BR')
      .includes(paletteQuery.trim().toLocaleLowerCase('pt-BR')),
  );

  return (
    <section className="command-page command-center-page" aria-labelledby="commands-title">
      <header className="command-header command-center-header">
        <div className="command-center-heading">
          <p className="eyebrow">Administração do bot</p>
          <h1 id="commands-title">Command Center</h1>
          <p>Controle o comportamento do FutHub e teste cada resposta antes de publicar.</p>
        </div>
        <aside className="bot-status-panel" aria-label="Status do bot">
          <div className="bot-status-heading">
            <span className={`bot-health bot-health--${configState}`} aria-hidden="true" />
            <div>
              <span>Status do bot</span>
              <strong>
                {configState === 'ready'
                  ? 'Bot configurado'
                  : configState === 'error'
                    ? 'Configuração indisponível'
                    : 'Consultando bot…'}
              </strong>
            </div>
            <small>{configState === 'ready' ? 'Tudo salvo' : 'API Admin'}</small>
          </div>
          <dl className="bot-status-metrics">
            <div>
              <dt>Ativos</dt>
              <dd>1</dd>
            </div>
            <div>
              <dt>Rascunhos</dt>
              <dd>0</dd>
            </div>
            <div>
              <dt>Configurados</dt>
              <dd>{configState === 'ready' ? '100%' : '—'}</dd>
            </div>
          </dl>
        </aside>
      </header>

      <div className="command-toolbar">
        <label className="command-search">
          <span className="sr-only">Buscar comando</span>
          <span aria-hidden="true">⌕</span>
          <input
            autoComplete="off"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por comando ou categoria"
            ref={searchRef}
            type="search"
            value={query}
          />
          {query ? (
            <button aria-label="Limpar busca" onClick={() => setQuery('')} type="button">
              ×
            </button>
          ) : null}
        </label>
        <button
          className="command-palette-trigger"
          onClick={() => {
            setPaletteQuery('');
            paletteDialogRef.current?.showModal();
          }}
          type="button"
        >
          Atalhos rápidos <kbd>Ctrl K</kbd>
        </button>
      </div>

      <div className="command-filter-row">
        <div className="command-filters" aria-label="Filtrar por categoria">
          {commandCategories.map((item) => (
            <button
              aria-pressed={category === item}
              key={item}
              onClick={() => setCategory(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
        <span>
          {visibleCommands.length} de {commandModules.length} módulos
        </span>
      </div>

      {visibleCommands.length ? (
        <div className="command-module-grid">
          {visibleCommands.map((command) => {
            const active = command.status === 'active';
            const displayStatus = active && configState === 'error' ? 'error' : command.status;
            return (
              <article
                className={`command-module-card${active ? ' command-module-card--featured' : ''}`}
                data-category={command.category}
                key={command.name}
              >
                <div className="command-card-topline">
                  <span className="command-glyph" aria-hidden="true">
                    {command.glyph}
                  </span>
                  <span className={`command-status command-status--${displayStatus}`}>
                    <i />
                    {displayStatus === 'active'
                      ? 'Ativo'
                      : displayStatus === 'error'
                        ? 'Com erro'
                        : 'Desativado'}
                  </span>
                </div>
                <div className="command-card-copy">
                  <p className="eyebrow">{command.category}</p>
                  <h2>{command.name}</h2>
                  <p>{command.description}</p>
                </div>
                {active ? (
                  <>
                    <dl className="command-card-stats">
                      <div>
                        <dt>Cooldown</dt>
                        <dd>{config ? commandDuration(config.cooldownSeconds) : '—'}</dd>
                      </div>
                      <div>
                        <dt>Recompensas</dt>
                        <dd>{config ? config.rewards.length : '—'}</dd>
                      </div>
                      <div>
                        <dt>Resposta</dt>
                        <dd>Embed</dd>
                      </div>
                    </dl>
                    <div className="command-card-actions">
                      <NavLink className="button-primary" to="/app/comandos/lucro">
                        Configurar
                      </NavLink>
                      <button
                        className="button-secondary command-test-button"
                        disabled={!config}
                        onClick={openPreview}
                        type="button"
                      >
                        <span aria-hidden="true">▶</span> Testar comando
                      </button>
                      <span className="command-saved-state">
                        <i />{' '}
                        {configState === 'ready' ? 'Configuração carregada' : 'Carregando dados'}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="command-coming-soon">
                    <span>Em breve</span>
                    <small>Módulo reservado no roadmap</small>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="command-empty-state">
          <span aria-hidden="true">/</span>
          <h2>Nenhum comando encontrado</h2>
          <p>Ajuste a busca ou volte para a visão completa.</p>
          <button
            className="button-secondary"
            onClick={() => {
              setQuery('');
              setCategory('Todos');
            }}
            type="button"
          >
            Limpar filtros
          </button>
        </div>
      )}

      <section className="command-roadmap" aria-labelledby="roadmap-title">
        <div>
          <p className="eyebrow">Próximos módulos</p>
          <h2 id="roadmap-title">O painel cresce junto com o FutHub.</h2>
        </div>
        <p>
          Futebol, coleção e administração já têm lugar definido sem competir com os comandos
          ativos.
        </p>
        <div className="command-roadmap-track" aria-label="Progresso dos módulos">
          <i />
          <span>1 ativo</span>
          <span>3 planejados</span>
        </div>
      </section>

      <dialog className="command-modal command-test-modal" ref={previewDialogRef}>
        <div className="command-modal-header">
          <div>
            <p className="eyebrow">Ambiente seguro</p>
            <h2>Testar /lucro</h2>
            <p>Prévia baseada na configuração atualmente salva.</p>
          </div>
          <button
            aria-label="Fechar teste"
            className="dialog-close"
            onClick={() => previewDialogRef.current?.close()}
            type="button"
          >
            ×
          </button>
        </div>
        <div className="command-test-layout">
          <aside className="command-test-controls">
            <span className="command-test-label">Cenário simulado</span>
            <div className="command-test-reward">
              <span>Recompensa sorteada</span>
              <strong>{currentReward ? `+${currentReward.value}` : '—'}</strong>
              <small>moedas</small>
            </div>
            <ul>
              <li>Jogador: Admin FutHub</li>
              <li>Saldo inicial: 2.350</li>
              <li>Nível atual: 12</li>
            </ul>
            <button
              className="button-secondary"
              disabled={!config}
              onClick={() => config && setPreviewReward(chooseReward(config.rewards))}
              type="button"
            >
              Executar novamente
            </button>
          </aside>
          <div className="discord-stage">
            <div className="discord-stage-bar">
              <span>Discord preview</span>
              <i>Somente visualização</i>
            </div>
            <div className="discord-message-preview">
              <div className="discord-bot-avatar" aria-hidden="true">
                F
              </div>
              <div className="discord-message-body">
                <div className="discord-message-author">
                  <strong>FutHub</strong>
                  <span>APP</span>
                  <time>Hoje às 12:00</time>
                </div>
                <div
                  className="discord-command-embed"
                  style={{ borderLeftColor: config?.embed.color ?? '#2b2d31' }}
                >
                  <strong>{config?.embed.title ?? '/lucro'}</strong>
                  <p>{renderDiscordMarkdown(renderedPreview)}</p>
                  <footer>{config?.embed.footer.replace('{availableAt}', 'em 10 minutos')}</footer>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="command-modal-footer">
          <span>Este teste não altera saldo nem envia mensagens.</span>
          <NavLink
            className="button-primary"
            onClick={() => previewDialogRef.current?.close()}
            to="/app/comandos/lucro"
          >
            Abrir configuração
          </NavLink>
        </div>
      </dialog>

      <dialog className="command-modal command-palette" ref={paletteDialogRef}>
        <div className="command-palette-search">
          <span aria-hidden="true">›</span>
          <label className="sr-only" htmlFor="command-palette-input">
            Buscar ação
          </label>
          <input
            autoComplete="off"
            autoFocus
            id="command-palette-input"
            onChange={(event) => setPaletteQuery(event.target.value)}
            placeholder="O que você deseja fazer?"
            value={paletteQuery}
          />
          <kbd>Esc</kbd>
        </div>
        <div className="command-palette-list">
          <span className="command-palette-label">Ações disponíveis</span>
          {paletteActions.length ? (
            paletteActions.map((action) => (
              <button key={action.label} onClick={action.run} type="button">
                <span className="command-palette-icon" aria-hidden="true">
                  /
                </span>
                <span>
                  <strong>{action.label}</strong>
                  <small>{action.detail}</small>
                </span>
                <i>{action.category}</i>
              </button>
            ))
          ) : (
            <p className="command-palette-empty">Nenhuma ação encontrada.</p>
          )}
        </div>
        <footer className="command-palette-footer">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> navegar
          </span>
          <span>
            <kbd>Enter</kbd> selecionar
          </span>
        </footer>
      </dialog>
    </section>
  );
}

function NotFoundPage() {
  return (
    <main className="login-page">
      <section className="login-card">
        <p className="eyebrow">404</p>
        <h1>Página não encontrada</h1>
        <NavLink className="button-primary" to="/">
          Voltar ao painel
        </NavLink>
      </section>
    </main>
  );
}
