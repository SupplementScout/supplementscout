const REVIEW_QUEUE_PATH = "/admin/automation-review";
const SAFE_QUERY_KEYS = new Set(["q", "retailer", "status", "scope", "kind", "group", "confidence", "capability", "queue", "display", "history", "page"]);

export function safeAutomationReviewReturnPath(input: FormDataEntryValue | string | null, saved: "decision" | "execution", allowedOrigin = "https://supplementscout.invalid") {
  const raw = String(input || "");
  try {
    const parsed = new URL(raw, `${allowedOrigin}${REVIEW_QUEUE_PATH}`);
    if (parsed.origin !== allowedOrigin || parsed.pathname !== REVIEW_QUEUE_PATH) return `${REVIEW_QUEUE_PATH}?saved=${saved}`;
    const safe = new URLSearchParams();
    for (const [key, value] of parsed.searchParams) if (SAFE_QUERY_KEYS.has(key)) safe.append(key, value.slice(0, 300));
    safe.delete("page");
    safe.set("saved", saved);
    return `${REVIEW_QUEUE_PATH}?${safe.toString()}`;
  } catch {
    return `${REVIEW_QUEUE_PATH}?saved=${saved}`;
  }
}
