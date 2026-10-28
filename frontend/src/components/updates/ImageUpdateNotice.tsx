export function ImageUpdateNotice({ latestVersion }: { latestVersion: string }) {
  return (
    <section className="max-w-3xl rounded-xl border border-danger/40 bg-panel p-3 shadow-card sm:p-4">
      <h2 className="text-sm font-bold tracking-tight text-ink">Nova versão disponível: v{latestVersion}</h2>
      <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
        Recomendamos fazer o deploy da nova imagem para receber as novidades e as correções de falhas.
      </p>
    </section>
  );
}
