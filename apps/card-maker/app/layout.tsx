import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import logo from '../../../assets/logo/logo.svg';

import './styles.css';

export const metadata: Metadata = {
  title: 'Dream Fut Card Maker',
  description: 'Crie e gerencie bases de cartas do Dream Fut.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <header className="site-header">
          <a aria-label="Dream Fut" className="site-logo" href="/">
            <img alt="Dream Fut" src={logo.src} />
          </a>
          <span>Card maker</span>
        </header>
        {children}
      </body>
    </html>
  );
}
