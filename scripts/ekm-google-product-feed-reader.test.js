const assert = require("node:assert/strict");
const test = require("node:test");
const {
  REQUIRED_COLUMNS,
  deriveUkShipping,
  normalizeWheyOkayUrl,
  parseFeedText,
  readEkmGoogleProductFeed,
} = require("./lib/ekm-google-product-feed-reader");

function feedText(rows = [{}]) {
  const values = rows.map((overrides, index) => {
    const variant = String(overrides.variant || index + 2);
    const parent = String(overrides.parent || 1);
    const base = Object.fromEntries(REQUIRED_COLUMNS.map((name) => [name, ""]));
    Object.assign(base, {
      id: `2ab763${variant}`,
      title: `Test ${variant}`,
      link: `https://wheyokay.com/test-${parent}-p.asp?_=&variantid=${variant}`,
      price: "10.00 GBP",
      condition: "new",
      shipping:
        "GB::FREE Delivery Over £60 Orders :0.00,GB::Royal Mail Standard:3.99",
      availability: "in stock",
      item_group_id: `2ab763${variant}`,
      identifier_exists: "no",
      ...overrides,
    });
    delete base.variant;
    delete base.parent;
    return REQUIRED_COLUMNS.map((name) => base[name]).join("\t");
  });
  return `${REQUIRED_COLUMNS.join("\t")}\n${values.join("\n")}\n`;
}
function response(body, { status = 200, headers = {} } = {}) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/plain",
      "last-modified": "Fri, 24 Jul 2026 01:01:14 GMT",
      ...headers,
    },
  });
}

test("healthy EKM feed enforces the 48-column contract and exact identity", () => {
  const feed = parseFeedText(feedText(), {
    capturedAt: "2026-07-24T02:00:00.000Z",
    lastModified: "2026-07-24T01:01:14.000Z",
    sourceUrl: "https://wheyokay.com/feed.txt",
    rawSha256: "a".repeat(64),
  });
  assert.equal(feed.column_count, 48);
  assert.equal(feed.row_count, 1);
  assert.equal(feed.product_count, 1);
  assert.equal(feed.rows[0].source_key, "1:2");
  assert.equal(feed.rows[0].url, "https://wheyokay.com/test-1-p.asp");
  assert.equal(feed.rows[0].price, "10.00");
  assert.equal(feed.rows[0].in_stock, true);
});

test("parent-only EKM rows use the identical parent and variant ID", () => {
  const text = feedText([
    {
      parent: "165",
      variant: "165",
      link: "https://wheyokay.com/test-165-p.asp",
    },
  ]);
  const feed = parseFeedText(text, {
    capturedAt: "2026-07-24T02:00:00.000Z",
    lastModified: "2026-07-24T01:01:14.000Z",
    sourceUrl: "https://wheyokay.com/feed.txt",
    rawSha256: "a".repeat(64),
  });
  assert.equal(feed.rows[0].source_key, "165:165");
});

test("malformed schema and duplicate identities fail closed", () => {
  const malformed = feedText().replace("is_bundle", "unexpected");
  assert.throws(
    () =>
      parseFeedText(malformed, {
        capturedAt: "2026-07-24T02:00:00Z",
        lastModified: "2026-07-24T01:01:14Z",
        sourceUrl: "https://wheyokay.com/feed.txt",
        rawSha256: "a",
      }),
    (error) => error.code === "EKM_SCHEMA_MISMATCH",
  );
  assert.throws(
    () =>
      parseFeedText(feedText([{ variant: 2 }, { variant: 2 }]), {
        capturedAt: "2026-07-24T02:00:00Z",
        lastModified: "2026-07-24T01:01:14Z",
        sourceUrl: "https://wheyokay.com/feed.txt",
        rawSha256: "a",
      }),
    (error) => error.code === "EKM_DUPLICATE_IDENTITY",
  );
});

test("URL normalization rejects host drift and variant drift", () => {
  assert.throws(
    () => normalizeWheyOkayUrl("https://example.com/test-1-p.asp?variantid=2", "2"),
    (error) => error.code === "EKM_URL_HOST_BLOCKED",
  );
  assert.throws(
    () =>
      normalizeWheyOkayUrl(
        "https://wheyokay.com/test-1-p.asp?variantid=3",
        "2",
      ),
    (error) => error.code === "EKM_VARIANT_ID_MISMATCH",
  );
});

test("shipping evidence derives the live threshold without mutating policy", () => {
  const routes =
    "GB::FREE Delivery Over £60 Orders :0.00,GB::Royal Mail Standard:3.99";
  assert.equal(deriveUkShipping(routes, "59.99"), "3.99");
  assert.equal(deriveUkShipping(routes, "60.00"), "0.00");
});

test("reader validates Last-Modified freshness and emits success diagnostics", async () => {
  const feed = await readEkmGoogleProductFeed({
    url: "https://wheyokay.com/feed.txt",
    capturedAt: "2026-07-24T02:00:00.000Z",
    fetchImpl: async () => response(feedText()),
    maximumAttempts: 1,
  });
  assert.equal(feed.diagnostic.result, "PASS");
  assert.equal(feed.diagnostic.http_status, 200);
  assert.equal(feed.diagnostic.row_count, 1);
  await assert.rejects(
    readEkmGoogleProductFeed({
      url: "https://wheyokay.com/feed.txt",
      capturedAt: "2026-07-26T02:00:00.000Z",
      fetchImpl: async () => response(feedText()),
      maximumAttempts: 1,
    }),
    (error) =>
      error.code === "EKM_FEED_STALE" &&
      error.diagnostic.result === "FAIL",
  );
});

test("reader retries transient failures and validates same-host redirects", async () => {
  let calls = 0;
  const feed = await readEkmGoogleProductFeed({
    url: "https://wheyokay.com/feed.txt",
    capturedAt: "2026-07-24T02:00:00.000Z",
    retryBaseDelayMs: 1,
    fetchImpl: async (url) => {
      calls += 1;
      if (calls === 1) return response("", { status: 503 });
      if (String(url).endsWith("/feed.txt")) {
        return response("", {
          status: 302,
          headers: { location: "/fresh-feed.txt" },
        });
      }
      return response(feedText());
    },
  });
  assert.equal(feed.diagnostic.retries, 1);
  assert.equal(feed.diagnostic.redirects.length, 1);
  assert.equal(calls, 3);
});
