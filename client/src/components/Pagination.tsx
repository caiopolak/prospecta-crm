import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({ page, pageSize, total, onPage }) => {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  const safePage = Math.min(page, pages);

  return (
    <nav
      aria-label="Paginação da tabela"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12, padding: '12px 2px 0', fontSize: 13, color: 'var(--text-muted)'
      }}
    >
      <span>
        Página <strong style={{ color: 'var(--text)' }}>{safePage}</strong> de {pages} · {total} registros
      </span>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="btn btn-secondary btn-small"
          onClick={() => onPage(safePage - 1)}
          disabled={safePage <= 1}
          aria-label="Página anterior"
        >
          <ChevronLeft size={14} /> Anterior
        </button>
        <button
          className="btn btn-secondary btn-small"
          onClick={() => onPage(safePage + 1)}
          disabled={safePage >= pages}
          aria-label="Próxima página"
        >
          Próxima <ChevronRight size={14} />
        </button>
      </div>
    </nav>
  );
};
