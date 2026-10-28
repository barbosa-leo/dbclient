'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { getDesktopBridge, onDesktopUpdateStatus } from '@/services/desktop';
import type { DesktopUpdateStatus } from '@/services/desktop';

const statusText: Record<DesktopUpdateStatus['state'], string> = {
  downloading: 'Baixando a nova versão…',
  installing: 'Instalando… o DBClient será reaberto ao terminar.',
  ready:
    'O instalador foi aberto. Feche o DBClient (⌘Q) e arraste o app para a pasta Aplicativos, substituindo a versão atual.',
  failed: 'Não foi possível atualizar.',
};

export function DesktopUpdateNotice({ latestVersion }: { latestVersion: string }) {
  const [platform, setPlatform] = useState<'macos' | 'windows' | null>(null);
  const [status, setStatus] = useState<DesktopUpdateStatus | null>(null);

  // The bridge only exists inside the native shell, so it is read after mount to match the static HTML.
  useEffect(() => {
    setPlatform(getDesktopBridge()?.platform ?? null);
    return onDesktopUpdateStatus(setStatus);
  }, []);

  if (!platform) return null;

  const busy = status?.state === 'downloading' || status?.state === 'installing';

  return (
    <section className="max-w-3xl rounded-xl border border-danger/40 bg-panel p-3 shadow-card sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold tracking-tight text-ink">Nova versão disponível: v{latestVersion}</h2>
          <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
            {platform === 'windows'
              ? 'O DBClient será fechado, atualizado e reaberto. Dumps e scripts em andamento serão cancelados.'
              : 'O instalador da nova versão será baixado e aberto.'}
          </p>
        </div>
        <Button
          type="button"
          disabled={busy}
          onClick={() => {
            setStatus({ state: 'downloading' });
            getDesktopBridge()?.installUpdate(latestVersion);
          }}
        >
          Atualizar para v{latestVersion}
        </Button>
      </div>

      {status && (
        <p
          role={status.state === 'failed' ? 'alert' : 'status'}
          className={`mt-2 text-xs leading-relaxed ${status.state === 'failed' ? 'text-danger' : 'text-ink-secondary'}`}
        >
          {statusText[status.state]}
          {status.message && ` ${status.message}`}
        </p>
      )}
    </section>
  );
}
