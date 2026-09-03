const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  GOOGLE_SCOPES,
  OUTPUT_ROOT,
  buildWeeklyReport,
  createServiceAccountJwt,
  normalizePropertyId,
  normalizeSiteUrl,
  parseEndDate,
  parseServiceAccount,
  reportingPeriod,
  safeRatio,
} = require("./growth-analytics-report");

const { privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" });
const credential = Buffer.from(
  JSON.stringify({
    type: "service_account",
    client_email: "growth-reader@example.iam.gserviceaccount.com",
    private_key: privateKeyPem,
  })
).toString("base64");

function response(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

test("credentials and property identifiers fail closed", () => {
  assert.throws(() => parseServiceAccount(""), /required/);
  assert.throws(
    () => parseServiceAccount(Buffer.from('{"type":"user"}').toString("base64")),
    /service account/
  );
  assert.equal(normalizePropertyId("properties/123456"), "123456");
  assert.throws(() => normalizePropertyId("G-ABC"), /digits only/);
  assert.equal(normalizeSiteUrl("sc-domain:supplementscout.co.uk"), "sc-domain:supplementscout.co.uk");
  assert.equal(normalizeSiteUrl("https://www.supplementscout.co.uk/"), "https://www.supplementscout.co.uk/");
  assert.throws(() => normalizeSiteUrl("http://example.com"), /HTTPS URL-prefix/);
});

test("JWT is short-lived and requests only the two read-only scopes", () => {
  const account = parseServiceAccount(credential);
  const jwt = createServiceAccountJwt(account, new Date("2026-08-01T12:00:00Z"));
  const [, payload] = jwt.split(".");
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));

  assert.equal(claims.exp - claims.iat, 3600);
  assert.equal(claims.iss, account.clientEmail);
  assert.deepEqual(claims.scope.split(" "), GOOGLE_SCOPES);
});

test("weekly period ends yesterday by default and accepts one exact override", () => {
  assert.deepEqual(reportingPeriod(new Date("2026-08-01T12:00:00Z")), {
    startDate: "2026-07-25",
    endDate: "2026-07-31",
  });
  assert.deepEqual(reportingPeriod(new Date(), "2026-07-20"), {
    startDate: "2026-07-14",
    endDate: "2026-07-20",
  });
  assert.equal(parseEndDate(["--end-date=2026-07-20"]), "2026-07-20");
  assert.throws(() => parseEndDate(["--output=elsewhere"]), /Usage/);
  assert.match(OUTPUT_ROOT, /tmp[\\/]growth-analytics$/);
});

test("CTR calculations fail closed when the denominator is absent", () => {
  assert.equal(safeRatio(3, 12), 0.25);
  assert.equal(safeRatio(3, 0), 0);
  assert.equal(safeRatio("invalid", 12), 0);
});

test("authenticated report combines GSC, sitemap and organic GA4 evidence", async () => {
  const requests = [];
  const fetchImpl = async (url, options = {}) => {
    requests.push({ url, options });
    if (url.includes("oauth2.googleapis.com/token")) {
      return response({ access_token: "test-token" });
    }
    if (url.endsWith("/sitemaps")) {
      return response({
        sitemap: [
          {
            path: "https://www.supplementscout.co.uk/sitemap.xml",
            isPending: false,
            warnings: "0",
            errors: "0",
            contents: [{ type: "web", submitted: "1071", indexed: "1000" }],
          },
        ],
      });
    }
    const body = JSON.parse(options.body);
    if (url.includes("searchAnalytics") && body.dimensions?.[0] === "query") {
      return response({ rows: [{ keys: ["whey protein"], clicks: 8, impressions: 100, ctr: 0.08, position: 4.2 }] });
    }
    if (url.includes("searchAnalytics") && body.dimensions?.length === 2) {
      return response({ rows: [{ keys: ["https://www.supplementscout.co.uk/creatine", "creatine prices uk"], clicks: 0, impressions: 24, ctr: 0, position: 18.5 }] });
    }
    if (url.includes("searchAnalytics") && body.dimensions?.[0] === "page") {
      return response({ rows: [{ keys: ["https://www.supplementscout.co.uk/whey-protein"], clicks: 6, impressions: 80, ctr: 0.075, position: 3.8 }] });
    }
    if (url.includes("searchAnalytics")) {
      return response({ rows: [{ clicks: 10, impressions: 150, ctr: 0.0667, position: 5.1 }] });
    }
    if (url.includes("urlInspection/index:inspect")) {
      const bodyData = JSON.parse(options.body);
      if (bodyData.inspectionUrl === "https://www.supplementscout.co.uk/whey-protein") {
        return response({
          inspectionResult: {
            indexStatusResult: {
              verdict: "PASS",
              coverageState: "PARTIALLY_INDEXED",
              indexingState: "INDEXING_ALLOWED",
              robotsTxtState: "ALLOWED",
              googleCanonical: "https://www.supplementscout.co.uk/whey-protein",
              userCanonical: "https://www.supplementscout.co.uk/whey-protein",
            },
          },
        });
      }
      return response({
        inspectionResult: {
          indexStatusResult: {
            verdict: "PASS",
            coverageState: "INDEXED",
            indexingState: "INDEXING_ALLOWED",
            robotsTxtState: "ALLOWED",
            googleCanonical: "https://www.supplementscout.co.uk/",
            userCanonical: "https://www.supplementscout.co.uk/",
          },
        },
      });
    }
    if (url.includes(":runFunnelReport")) {
      return response({
        funnelTable: {
          dimensionHeaders: [{ name: "funnelStepName" }],
          metricHeaders: [{ name: "activeUsers" }],
          rows: [
            {
              dimensionValues: [{ value: "1. Alternative selected" }],
              metricValues: [{ value: "3" }],
            },
            {
              dimensionValues: [{ value: "2. Retailer offer clicked" }],
              metricValues: [{ value: "2" }],
            },
          ],
        },
      });
    }
    if (body.dimensions?.[0]?.name === "eventName") {
      return response({
        dimensionHeaders: [{ name: "eventName" }],
        metricHeaders: [{ name: "eventCount" }],
        rows: [
          {
            dimensionValues: [{ value: "view_better_value_alternatives" }],
            metricValues: [{ value: "12" }],
          },
          {
            dimensionValues: [{ value: "select_better_value_alternative" }],
            metricValues: [{ value: "3" }],
          },
        ],
      });
    }
    if (body.dimensionFilter) {
      return response({ metricHeaders: [{ name: "eventCount" }], rows: [{ metricValues: [{ value: "4" }] }] });
    }
    return response({
      dimensionHeaders: [{ name: "sessionDefaultChannelGroup" }],
      metricHeaders: [{ name: "sessions" }, { name: "totalUsers" }, { name: "screenPageViews" }],
      rows: [{ dimensionValues: [{ value: "Organic Search" }], metricValues: [{ value: "20" }, { value: "16" }, { value: "31" }] }],
    });
  };

  const report = await buildWeeklyReport({
    env: {
      GOOGLE_SERVICE_ACCOUNT_JSON_B64: credential,
      GA4_PROPERTY_ID: "123456",
      GSC_SITE_URL: "sc-domain:supplementscout.co.uk",
    },
    now: new Date("2026-08-01T12:00:00Z"),
    fetchImpl,
  });

  assert.equal(report.searchConsole.totals.clicks, 10);
  assert.equal(report.searchConsole.topQueries[0].query, "whey protein");
  assert.deepEqual(report.searchConsole.opportunities[0], {
    page: "https://www.supplementscout.co.uk/creatine",
    query: "creatine prices uk",
    clicks: 0,
    impressions: 24,
    ctr: 0,
    position: 18.5,
  });
  assert.equal(report.schemaVersion, 3);
  assert.equal(report.searchConsole.sitemaps[0].errors, 0);
  assert.deepEqual(report.ga4.organicSearch, {
    sessions: 20,
    users: 16,
    views: 31,
    retailerOfferClicks: 4,
  });
  assert.deepEqual(report.ga4.betterValueAlternatives, {
    impressions: 12,
    clicks: 3,
    clickThroughRate: 0.25,
    selectingUsers: 3,
    downstreamRetailerClickUsers: 2,
    downstreamRetailerClickThroughRate: 2 / 3,
    downstreamWindowMinutes: 30,
  });
  assert.equal(report.searchConsole.indexing.inspectionTargets.length, 2);
  assert.equal(report.searchConsole.indexing.inspections[0].state, "ok");
  assert.equal(report.searchConsole.indexing.inspectedCount, 2);
  assert.match(report.limitations.pageIndexingTotals, /URL-level/);
  assert.equal(requests.length, 12);
  const gscBodies = requests
    .filter(({ url }) => url.includes("searchAnalytics"))
    .map(({ options }) => JSON.parse(options.body));
  assert.ok(gscBodies.some((body) => body.rowLimit === 100 && body.dimensions?.[0] === "page"));
  assert.ok(gscBodies.some((body) => body.rowLimit === 250 && body.dimensions?.join(",") === "page,query"));
  assert.ok(requests.slice(1).every(({ options }) => options.headers.Authorization === "Bearer test-token"));
  const funnelRequest = requests.find(({ url }) => url.includes(":runFunnelReport"));
  assert.ok(funnelRequest.url.includes("/v1alpha/"));
  assert.deepEqual(
    JSON.parse(funnelRequest.options.body).funnel.steps.map((step) => step.name),
    ["Alternative selected", "Retailer offer clicked"]
  );
  assert.equal(
    JSON.parse(funnelRequest.options.body).funnel.steps[1].withinDurationFromPriorStep,
    "1800s"
  );
});

test("Google API errors stop the report without fabricated evidence", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) return response({ access_token: "test-token" });
    return response({ error: { message: "permission denied" } }, 403);
  };

  await assert.rejects(
    buildWeeklyReport({
      env: {
        GOOGLE_SERVICE_ACCOUNT_JSON_B64: credential,
        GA4_PROPERTY_ID: "123456",
        GSC_SITE_URL: "sc-domain:supplementscout.co.uk",
      },
      now: new Date("2026-08-01T12:00:00Z"),
      fetchImpl,
    }),
    /permission denied/
  );
});

test("scheduled workflow is read-only, protected and publishes only report artifacts", () => {
  const workflow = fs.readFileSync(
    path.join(process.cwd(), ".github", "workflows", "growth-analytics-report.yml"),
    "utf8"
  );

  assert.match(workflow, /permissions:\s*\n\s*contents: read/);
  assert.match(workflow, /actions: read/);
  assert.match(workflow, /environment: production-readonly/);
  assert.match(workflow, /cron: "37 8 \* \* 1"/);
  assert.match(workflow, /cron: "37 12 \* \* 1"/);
  assert.match(workflow, /event=schedule&status=success/);
  assert.match(workflow, /steps\.weekly\.outputs\.needed == 'true'/);
  assert.match(workflow, /secrets\.GOOGLE_SERVICE_ACCOUNT_JSON_B64/);
  assert.match(workflow, /vars\.GA4_PROPERTY_ID/);
  assert.match(workflow, /vars\.GSC_SITE_URL/);
  assert.match(workflow, /path: tmp\/growth-analytics\/\*\.json/);
  assert.doesNotMatch(workflow, /contents: write|git push|service_role|SUPABASE/);
});
