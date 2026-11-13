// Page-number navigation: Previous, 1 2 3 … N, Next.
function pageItems(current: number, total: number): (number | 'gap')[] {
  const pages = new Set(
    [1, total, current - 1, current, current + 1].filter(
      (page) => page >= 1 && page <= total
    )
  );
  const sorted = [...pages].sort((a, b) => a - b);
  const items: (number | 'gap')[] = [];
  sorted.forEach((page, index) => {
    if (index && page - sorted[index - 1] > 1) items.push('gap');
    items.push(page);
  });
  return items;
}

export default function Pagination({
  page,
  pageCount,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav className="pagination" aria-label="Recipe pages">
      <button
        className="secondary-button"
        disabled={page === 1}
        onClick={() => onPageChange(page - 1)}
        type="button"
      >
        Previous
      </button>
      {pageItems(page, pageCount).map((item, index) =>
        item === 'gap' ? (
          <span key={`gap-${index}`} className="pagination-gap" aria-hidden>
            …
          </span>
        ) : (
          <button
            className={item === page ? 'primary-button' : 'secondary-button'}
            aria-current={item === page ? 'page' : undefined}
            aria-label={`Page ${item}`}
            key={item}
            onClick={() => onPageChange(item)}
            type="button"
          >
            {item}
          </button>
        )
      )}
      <button
        className="secondary-button"
        disabled={page === pageCount}
        onClick={() => onPageChange(page + 1)}
        type="button"
      >
        Next
      </button>
    </nav>
  );
}
