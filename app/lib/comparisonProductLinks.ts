function normalizedVariantId(exactVariantId: string | null) {
  const value = exactVariantId?.trim() || "";
  return /^[1-9][0-9]*$/.test(value) ? value : null;
}

function withAnchor(href: string, anchor: string | null) {
  if (!anchor) return href;
  const withoutExistingAnchor = href.split("#", 1)[0];
  return `${withoutExistingAnchor}#${encodeURIComponent(anchor)}`;
}

export function comparisonProductHref(
  productUrl: string,
  exactVariantId: string | null,
  anchor: string | null = null
) {
  const variantId = normalizedVariantId(exactVariantId);
  if (!variantId) return withAnchor(productUrl, anchor);

  const withoutExistingAnchor = productUrl.split("#", 1)[0];
  const separator = withoutExistingAnchor.includes("?") ? "&" : "?";
  return withAnchor(
    `${withoutExistingAnchor}${separator}variant=${encodeURIComponent(variantId)}`,
    anchor
  );
}
