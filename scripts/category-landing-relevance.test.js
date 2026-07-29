const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const routeCategories = new Map([
  ["glucosamine", "glucosamine"],
  ["magnesium", "magnesium"],
  ["omega-3", "omega-3"],
  ["vitamin-d", "vitamin-d"],
  ["vitamins", "vitamins"],
]);

for (const [route, category] of routeCategories) {
  test(`${route} uses the shared reviewed landing relevance gate`, () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "app", route, "page.tsx"),
      "utf8"
    );

    assert.match(source, /isReviewedLandingProductMatch/);
    assert.match(
      source,
      new RegExp(
        `productFilter:\\s*\\(product\\)\\s*=>\\s*[\\s\\S]*isReviewedLandingProductMatch\\("${category}", product\\)`
      )
    );
  });
}

test("reviewed landing source queries do not fetch known excluded identities", () => {
  const glucosamine = fs.readFileSync(
    path.join(process.cwd(), "app", "glucosamine", "page.tsx"),
    "utf8"
  );
  const omega3 = fs.readFileSync(
    path.join(process.cwd(), "app", "omega-3", "page.tsx"),
    "utf8"
  );

  assert.doesNotMatch(glucosamine, /"joint support"|"joint care"|"collagen"/);
  assert.doesNotMatch(omega3, /"starflower oil"|"evening primrose oil"/);
});
