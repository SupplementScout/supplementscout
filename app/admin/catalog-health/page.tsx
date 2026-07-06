import { requireAdminPage } from "../../lib/adminAuth";
import {
  getCatalogHealthLoadErrorMessage,
  normalizeCatalogHealthFilters,
} from "../lib/catalogHealthFilters";
import { CatalogHealthDashboard } from "./components";

export const dynamic = "force-dynamic";

type SearchParams = {
  issue?: string | string[];
  retailer?: string | string[];
  category?: string | string[];
  staleAge?: string | string[];
  page?: string | string[];
};

export default async function CatalogHealthPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdminPage();

  const params = await searchParams;
  const filters = normalizeCatalogHealthFilters(params);
  const { loadCatalogHealthReport } = await import("../lib/catalogHealth");

  let report: Awaited<ReturnType<typeof loadCatalogHealthReport>> | null = null;
  let loadError = "";

  try {
    report = await loadCatalogHealthReport({ filters });
  } catch (error) {
    loadError = getCatalogHealthLoadErrorMessage(error);
  }

  return <CatalogHealthDashboard report={report} loadError={loadError} />;
}
