interface PageHeaderProps {
  title: string;
  description: string;
  badge?: string;
}

export function PageHeader({ title, description, badge = 'Live' }: PageHeaderProps) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2.5">
        <h1 className="text-xl font-bold tracking-tight break-words text-ink lg:text-2xl">{title}</h1>
        {badge && (
          <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-ink-secondary">
            {badge}
          </span>
        )}
      </div>
      <p className="mt-1 text-xs font-normal text-ink-muted">{description}</p>
    </div>
  );
}
