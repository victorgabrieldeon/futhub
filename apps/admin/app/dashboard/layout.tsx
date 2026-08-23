import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { LogoutButton } from './logout-button';

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const apiKey = (await cookies()).get('admin_api_key')?.value;
  if (!apiKey) redirect('/login');

  return (
    <main className="admin-shell">
      <header className="top-nav">
        <a className="brand-lockup" href="/dashboard/lucro">
          <span className="brand-mark" aria-hidden="true" />
          <strong>FutHub</strong>
          <span className="brand-divider" />
          <span>Admin</span>
        </a>
        <div className="nav-actions">
          <span className="session-state">API key ativa</span>
          <LogoutButton />
        </div>
      </header>

      <div className="admin-workspace">
        <aside className="command-sidebar" aria-label="Comandos do bot">
          <p className="eyebrow">Comandos</p>
          <nav>
            <a aria-current="page" href="/dashboard/lucro">
              <span>/lucro</span>
              <small>Economia</small>
            </a>
          </nav>
          <p className="sidebar-note">Novos comandos configuráveis entram nesta lista.</p>
        </aside>
        {children}
      </div>
    </main>
  );
}
