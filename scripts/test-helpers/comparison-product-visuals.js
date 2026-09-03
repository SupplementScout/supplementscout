const React = require("react");

function ComparisonProductThumbnail({ name, productUrl }) {
  return React.createElement(
    "a",
    { href: productUrl, "aria-label": `View ${name}` },
    React.createElement("span", { role: "img", "aria-label": `${name} product image` })
  );
}

function OfferCheckedBadge({ checkedAt }) {
  return React.createElement("p", null, `Offer checked ${checkedAt || "unavailable"}`);
}

function UnavailableComparisonProductCard({ row }) {
  return React.createElement("article", null, `Availability being rechecked: ${row.name}`);
}

module.exports = { ComparisonProductThumbnail, OfferCheckedBadge, UnavailableComparisonProductCard };
