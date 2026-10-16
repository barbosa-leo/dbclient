export function PageHeader({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-brand-900">{title}</h1>
      <p className="mt-1 text-sm font-normal text-brand-700/90">{description}</p>
    </div>
  );
}
