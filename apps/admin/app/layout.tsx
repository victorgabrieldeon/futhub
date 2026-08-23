import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'FutHub Admin',
  description: 'Operação do FutHub',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
