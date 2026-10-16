export function PageHeader({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-brand-900">{title}</h1>
      <p className="mt-1 text-sm text-brand-700">{description}</p>
    </div>
  );
}
