import type { NavIconName } from '@/components/layout/navigation';

export function NavIcon({ name }: { name: NavIconName }) {
  switch (name) {
    case 'explorer':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="h-[18px] w-[18px] shrink-0">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case 'query':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="h-[18px] w-[18px] shrink-0">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="m8 10 3 2.5L8 15" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13 15h3" strokeLinecap="round" />
        </svg>
      );
    case 'scripts':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="h-[18px] w-[18px] shrink-0">
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" strokeLinejoin="round" />
          <path d="M14 3v5h5" strokeLinejoin="round" />
          <path d="M9 13h6M9 17h4" strokeLinecap="round" />
        </svg>
      );
    case 'dumps':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="h-[18px] w-[18px] shrink-0">
          <path d="M12 3 4 7.5 12 12l8-4.5L12 3Z" strokeLinejoin="round" />
          <path d="M4 12.5 12 17l8-4.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 17 12 21.5 20 17" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'connections':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="h-[18px] w-[18px] shrink-0">
          <rect x="3" y="4" width="18" height="6" rx="1.5" />
          <rect x="3" y="14" width="18" height="6" rx="1.5" />
          <circle cx="7" cy="7" r="1" fill="currentColor" />
          <circle cx="7" cy="17" r="1" fill="currentColor" />
        </svg>
      );
    case 'users':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="h-[18px] w-[18px] shrink-0">
          <circle cx="9" cy="8" r="3.5" />
          <path d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" strokeLinecap="round" />
          <circle cx="17" cy="9.5" r="2.5" />
          <path d="M16 14.8c2.2.3 4 1.8 4 4.2" strokeLinecap="round" />
        </svg>
      );
  }
}
