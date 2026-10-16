import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/components/auth/AuthProvider';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'DBClient',
  description: 'Gerenciamento e exploração de bancos PostgreSQL',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
