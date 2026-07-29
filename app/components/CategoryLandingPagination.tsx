import Link from "next/link";
import { categoryLandingPageHref } from "../lib/categoryLandingPagination";

type CategoryLandingPaginationProps = {
  basePath: string;
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

export default function CategoryLandingPagination({
  basePath,
  currentPage,
  totalPages,
}: CategoryLandingPaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav
      aria-label="Category result pages"
      className="mt-8 flex flex-wrap items-center justify-center gap-2"
    >
      {currentPage > 1 ? (
        <Link
          href={categoryLandingPageHref(basePath, currentPage - 1)}
          className="min-h-11 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-950"
          aria-label={`Go to category page ${currentPage - 1}`}
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
            href={categoryLandingPageHref(basePath, page)}
            aria-label={`Go to category page ${page}`}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-950"
          >
            {page}
          </Link>
        )
      )}

      {currentPage < totalPages ? (
        <Link
          href={categoryLandingPageHref(basePath, currentPage + 1)}
          className="min-h-11 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-950"
          aria-label={`Go to category page ${currentPage + 1}`}
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
