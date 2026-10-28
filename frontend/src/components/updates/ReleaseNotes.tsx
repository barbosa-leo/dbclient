import { changeCategories } from '@/components/updates/releases';
import type { Release } from '@/components/updates/releases';

// Parsing "YYYY-MM-DD" with new Date() would read it as UTC midnight and show the previous day in Brazil.
function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

interface ReleaseNotesProps {
  release: Release;
  installed: boolean;
  available: boolean;
  unread: boolean;
}

export function ReleaseNotes({ release, installed, available, unread }: ReleaseNotesProps) {
  return (
    <article
      className={`rounded-xl border p-3 shadow-card sm:p-4 ${unread ? 'border-danger/40' : 'border-line'} ${
        unread && !installed ? 'bg-panel' : 'bg-subtle'
      }`}
    >
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-bold tracking-tight text-ink">v{release.version}</h2>
        {installed && (
          <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-ink-secondary">
            Atual
          </span>
        )}
        <time dateTime={release.date} className="text-xs text-ink-muted">
          {formatDate(release.date)}
        </time>
        {available && release.url && (
          <a
            href={release.url}
            target="_blank"
            rel="noreferrer"
            className="ml-auto text-xs font-medium text-ink-secondary underline-offset-2 hover:text-ink hover:underline"
          >
            Ver no GitHub
          </a>
        )}
      </header>

      <div className="mt-3 flex flex-col gap-3">
        {changeCategories.map(({ key, label }) => {
          const items = release.changes[key];
          if (!items?.length) return null;
          return (
            <section key={key}>
              <h3 className="text-[10px] font-semibold tracking-wider text-ink-muted uppercase">{label}</h3>
              <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-4 text-xs leading-relaxed text-ink">
                {items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </article>
  );
}
