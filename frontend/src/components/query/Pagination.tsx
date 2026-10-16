import { Button } from '@/components/ui/Button';

interface PaginationProps {
  page: number;
  hasMore: boolean;
  disabled: boolean;
  onChange: (page: number) => void;
}

export function Pagination({ page, hasMore, disabled, onChange }: PaginationProps) {
  return (
    <div className="flex items-center justify-end gap-3">
      <Button variant="secondary" disabled={disabled || page <= 1} onClick={() => onChange(page - 1)}>
        Anterior
      </Button>
      <span className="text-sm text-brand-700">Página {page}</span>
      <Button variant="secondary" disabled={disabled || !hasMore} onClick={() => onChange(page + 1)}>
        Próxima
      </Button>
    </div>
  );
}
