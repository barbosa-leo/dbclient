import { AuthCard } from '@/components/auth/AuthCard';

export function LocalSessionEnded() {
  return (
    <AuthCard title="Sessão encerrada">
      <p className="text-sm text-ink-secondary">
        Feche e abra o DBClient novamente para continuar.
      </p>
    </AuthCard>
  );
}
