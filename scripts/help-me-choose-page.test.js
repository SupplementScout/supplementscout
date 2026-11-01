const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = process.cwd();
const page = fs.readFileSync(
  path.join(ROOT, "app/help-me-choose/page.tsx"),
  "utf8"
);
const homepage = fs.readFileSync(path.join(ROOT, "app/page.tsx"), "utf8");
const analytics = fs.readFileSync(
  path.join(ROOT, "app/lib/analytics.ts"),
  "utf8"
);
const analyticsComponent = fs.readFileSync(
  path.join(ROOT, "app/components/DecisionAnalytics.tsx"),
  "utf8"
);
const decisionSearch = fs.readFileSync(
  path.join(ROOT, "app/lib/decisionSearch.ts"),
  "utf8"
);

test("homepage exposes one secondary Help me choose entry", () => {
  assert.match(homepage, /href="\/help-me-choose"/);
  assert.match(homepage, />\s*Help me choose\s*</);
  assert.equal((homepage.match(/href="\/help-me-choose"/g) || []).length, 1);
});
test("Help Me Choose uses shareable GET state and Next 16 async searchParams", () => {
  assert.match(page, /import Form from "next\/form"/);
  assert.match(page, /action="\/help-me-choose"/);
  assert.match(page, /name="q"/);
  assert.match(page, /searchParams: Promise<HelpMeChooseSearchParams>/);
  assert.match(page, /const params = await searchParams/);
  assert.match(page, /priority/);
  assert.match(page, /searchIntentParamsFromPlan\(options\.plan\)/);
  assert.doesNotMatch(page, /function decisionHref\(options: \{[^}]*caffeineFree:/);
});

test("priority selection uses document navigation so history reloads URL-derived state", () => {
  assert.match(analyticsComponent, /<a\s+href=\{href\}/);
  assert.doesNotMatch(analyticsComponent, /<Link\s+href=\{href\}[\s\S]*decision_priority_selected/);
});
test("canonical base is stable and parameterized decision states are noindex follow", () => {
  assert.match(page, /alternates: \{ canonical: "\/help-me-choose" \}/);
  assert.match(page, /robots: \{ index: !hasDecisionState, follow: true \}/);
});

test("result links preserve exact variants and do not expose an unsafe compare CTA", () => {
  assert.match(page, /href=\{item\.productHref\}/);
  assert.match(page, /variantId=\{item\.variantId\}/);
  assert.doesNotMatch(page, /Compare this pick|Compare picks/);
});

test("answered shortlists expose one bounded secondary Search escape hatch", () => {
  assert.match(page, /shouldShowDecisionSearchLink\(result\)/);
  assert.match(page, /decisionSearchHref\(\{/);
  assert.match(page, /data-decision-view-all-matches/);
  assert.match(page, />\s*View all matching products\s*</);
  assert.equal((page.match(/View all matching products/g) || []).length, 1);
  assert.doesNotMatch(page, /Load more|View all \{result\.|matching products\}/);
});

test("full Search escape hatch reuses effective intent and priority definitions", () => {
  assert.match(decisionSearch, /searchIntentParamsFromPlan\(options\.plan\)/);
  assert.match(
    decisionSearch,
    /DECISION_PRIORITY_DEFINITIONS\[options\.priority\]\.sort/
  );
  assert.match(decisionSearch, /result\.status === "ANSWERED"/);
  assert.match(
    decisionSearch,
    /result\.candidateCount > result\.shortlist\.length/
  );
  assert.doesNotMatch(
    decisionSearch,
    /LOWEST_DELIVERED_PRICE\s*:|LOWEST_PRICE_PER_SERVING\s*:/
  );
});

test("bounded analytics never send raw query, health phrases or local storage", () => {
  for (const event of [
    "help_me_choose_started",
    "decision_priority_selected",
    "decision_results_viewed",
    "decision_product_opened",
    "decision_clarification_shown",
  ]) {
    assert.match(analytics, new RegExp(event));
  }
  assert.doesNotMatch(analyticsComponent, /raw_query|query_text|search_term|health_phrase|localStorage|my_supplements/i);
  assert.doesNotMatch(page, /decision_view_all_clicked|localStorage/);
});

test("UI is semantic, mobile-first and contains no score or chat treatment", () => {
  assert.match(page, /<label htmlFor="decision-query"/);
  assert.match(page, /<button\s+type="submit"/);
  assert.match(page, /overflow-x-hidden/);
  assert.match(page, /grid gap-4 lg:grid-cols-3/);
  assert.doesNotMatch(page, /message bubble|chat transcript|scout score/i);
  assert.doesNotMatch(page, /deterministic product matching|comparable current candidate|fresh exact-variant offer|does not use AI/i);
});
