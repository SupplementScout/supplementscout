import Link from "next/link";
import type { SearchFilters, SearchSort } from "../lib/products";
import { searchUrl } from "../lib/searchUrl";

type SearchPaginationProps = {
  query: string;
  sort: SearchSort;
  filters: SearchFilters;
  currentPage: number;
  totalPages: number;
};

function compactPageRange(currentPage: number, totalPages: number) {
  const pages = new Set([1, totalPages]);

  for (let page = currentPage - 1; page <= currentPage + 1; page += 1) {
    if (page >= 1 && page <= totalPages) {
      pages.add(page);
    }
  }

  const sortedPages = Array.from(pages).sort((left, right) => left - right);
  const range: Array<number | "ellipsis"> = [];

  for (const page of sortedPages) {
    const previous = range[range.length - 1];

    if (typeof previous === "number" && page - previous > 1) {
      range.push("ellipsis");
    }

    range.push(page);
  }

  return range;
}

export default function SearchPagination({
  query,
  sort,
  filters,
  currentPage,
  totalPages,
}: SearchPaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const previousPage = currentPage - 1;
  const nextPage = currentPage + 1;

  return (
    <nav
      aria-label="Search result pages"
      className="mt-8 flex flex-wrap items-center justify-center gap-2"
    >
      {currentPage > 1 ? (
        <Link
          href={searchUrl({ query, sort, filters, page: previousPage })}
          className="min-h-11 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-950"
          aria-label={`Go to page ${previousPage}`}
        >
          Previous
        </Link>
      ) : (
        <span
          aria-disabled="true"
          className="min-h-11 rounded-lg border border-zinc-200 bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-400"
        >
          Previous
        </span>
      )}

      {compactPageRange(currentPage, totalPages).map((page, index) =>
        page === "ellipsis" ? (
          <span
            key={`ellipsis-${index}`}
            aria-hidden="true"
            className="px-2 text-sm text-zinc-500"
          >
            ...
          </span>
        ) : page === currentPage ? (
          <span
            key={page}
            aria-current="page"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-zinc-950 px-3 py-2 text-sm font-semibold text-white"
          >
            {page}
          </span>
        ) : (
          <Link
            key={page}
            href={searchUrl({ query, sort, filters, page })}
            aria-label={`Go to page ${page}`}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-950"
          >
            {page}
          </Link>
        )
      )}

      {currentPage < totalPages ? (
        <Link
          href={searchUrl({ query, sort, filters, page: nextPage })}
          className="min-h-11 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-950"
          aria-label={`Go to page ${nextPage}`}
        >
          Next
        </Link>
      ) : (
        <span
          aria-disabled="true"
          className="min-h-11 rounded-lg border border-zinc-200 bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-400"
        >
          Next
        </span>
      )}
    </nav>
  );
}
