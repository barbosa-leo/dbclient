'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageHeader } from '@/components/layout/PageHeader';
import { SettingsForm } from '@/components/settings/SettingsForm';
import { getSettings } from '@/services/settings';
import type { Settings } from '@/services/settings';

export default function SettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    getSettings()
      .then(setSettings)
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Falha ao carregar as configurações'),
      );
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <PageHeader
        title="Configurações"
        description="Apenas administradores podem alterar as configurações."
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <PageHeader title="Configurações" description="Ajuste os parâmetros da plataforma." />

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {settings ? (
        <SettingsForm settings={settings} onSaved={setSettings} />
      ) : (
        !error && <p className="text-xs text-ink-muted">Carregando...</p>
      )}
    </div>
  );
}

