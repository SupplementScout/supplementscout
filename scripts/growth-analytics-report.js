const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GA4_API_ROOT = "https://analyticsdata.googleapis.com/v1beta";
const GSC_API_ROOT = "https://www.googleapis.com/webmasters/v3";
const GSC_INDEXING_API_URL = "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect";
const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/webmasters.readonly",
];
const OUTPUT_ROOT = path.join(process.cwd(), "tmp", "growth-analytics");

function base64Url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function requiredString(value, name) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) throw new Error(`${name} is required.`);
  return normalized;
}

function parseServiceAccount(encoded) {
  const raw = Buffer.from(
    requiredString(encoded, "GOOGLE_SERVICE_ACCOUNT_JSON_B64"),
    "base64"
  ).toString("utf8");
  let account;

  try {
    account = JSON.parse(raw);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON_B64 is not valid base64 JSON.");
  }

  if (account.type !== "service_account") {
    throw new Error("Google credential must be a service account.");
  }

  return {
    clientEmail: requiredString(account.client_email, "service account client_email"),
    privateKey: requiredString(account.private_key, "service account private_key"),
  };
}

function normalizePropertyId(value) {
  const propertyId = requiredString(value, "GA4_PROPERTY_ID").replace(
    /^properties\//,
    ""
  );
  if (!/^\d+$/.test(propertyId)) {
    throw new Error("GA4_PROPERTY_ID must contain digits only.");
  }
  return propertyId;
}

function normalizeSiteUrl(value) {
  const siteUrl = requiredString(value, "GSC_SITE_URL");
  if (!/^https:\/\/.+\/$/.test(siteUrl) && !/^sc-domain:[a-z0-9.-]+$/i.test(siteUrl)) {
    throw new Error(
      "GSC_SITE_URL must be an HTTPS URL-prefix ending in / or an sc-domain property."
    );
  }
  return siteUrl;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function inspectionBaseSite(siteUrl) {
  if (siteUrl.startsWith("sc-domain:")) {
    return `https://${siteUrl.slice("sc-domain:".length)}`;
  }
  try {
    return new URL(siteUrl).origin;
  } catch {
    return "https://www.supplementscout.co.uk";
  }
}

function inspectableUrl(siteUrl, pagePath) {
  const trimmed = typeof pagePath === "string" ? pagePath.trim() : "";
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const base = inspectionBaseSite(siteUrl).replace(/\/$/, "");
  if (trimmed.startsWith("/")) return `${base}${trimmed}`;
  return `${base}/${trimmed}`;
}

function orderedUnique(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const candidate = typeof value === "string" ? value.trim() : "";
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    out.push(candidate);
  }
  return out;
}

function buildInspectionTargets(siteUrl, topPages) {
  const candidates = orderedUnique([
    `${inspectionBaseSite(siteUrl)}/`,
    ...topPages.map((row) => inspectableUrl(siteUrl, row.page)),
  ]);
  return candidates.slice(0, 6);
}

function reportingPeriod(now, requestedEndDate) {
  const endDate = requestedEndDate
    ? new Date(`${requestedEndDate}T00:00:00.000Z`)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  if (Number.isNaN(endDate.getTime()) || isoDate(endDate) !== (requestedEndDate || isoDate(endDate))) {
    throw new Error("--end-date must use YYYY-MM-DD.");
  }
  const startDate = new Date(endDate);
  startDate.setUTCDate(startDate.getUTCDate() - 6);
  return { startDate: isoDate(startDate), endDate: isoDate(endDate) };
}

function createServiceAccountJwt(account, now) {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(
    JSON.stringify({
      iss: account.clientEmail,
      scope: GOOGLE_SCOPES.join(" "),
      aud: GOOGLE_TOKEN_URL,
      iat: issuedAt,
      exp: issuedAt + 3600,
    })
  );
  const unsigned = `${header}.${claim}`;
  const signature = crypto.sign("RSA-SHA256", Buffer.from(unsigned), account.privateKey);
  return `${unsigned}.${base64Url(signature)}`;
}

async function googleRequest(fetchImpl, url, accessToken, options = {}) {
  const response = await fetchImpl(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error(`Google API returned non-JSON HTTP ${response.status}.`);
    }
  }
  if (!response.ok) {
    const message = body?.error?.message || `HTTP ${response.status}`;
    throw new Error(`Google API request failed: ${message}`);
  }
  return body || {};
}

async function getAccessToken(fetchImpl, account, now) {
  const assertion = createServiceAccountJwt(account, now);
  const response = await fetchImpl(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const body = await response.json();
  if (!response.ok || typeof body.access_token !== "string") {
    throw new Error(`Google token request failed: ${body?.error_description || body?.error || response.status}`);
  }
  return body.access_token;
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function gscRows(response, keyName) {
  return (response.rows || []).map((row) => ({
    [keyName]: row.keys?.[0] || "",
    clicks: numberValue(row.clicks),
    impressions: numberValue(row.impressions),
    ctr: numberValue(row.ctr),
    position: numberValue(row.position),
  }));
}

function gaMetricRows(response) {
  const dimensionNames = (response.dimensionHeaders || []).map((item) => item.name);
  const metricNames = (response.metricHeaders || []).map((item) => item.name);
  return (response.rows || []).map((row) => ({
    ...Object.fromEntries(
      dimensionNames.map((name, index) => [name, row.dimensionValues?.[index]?.value || ""])
    ),
    ...Object.fromEntries(
      metricNames.map((name, index) => [name, numberValue(row.metricValues?.[index]?.value)])
    ),
  }));
}

async function postJson(fetchImpl, url, accessToken, body) {
  return googleRequest(fetchImpl, url, accessToken, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function inspectUrlIndexing(fetchImpl, accessToken, siteUrl, inspectionUrl) {
  const response = await postJson(
    fetchImpl,
    GSC_INDEXING_API_URL,
    accessToken,
    {
      inspectionUrl,
      siteUrl,
    }
  );
  const indexStatus = response.inspectionResult?.indexStatusResult || {};
  return {
    inspectionUrl,
    state: "ok",
    verdict: indexStatus.verdict || null,
    coverageState: indexStatus.coverageState || null,
    indexingState: indexStatus.indexingState || null,
    robotsTxtState: indexStatus.robotsTxtState || null,
    googleCanonical: indexStatus.googleCanonical || null,
    userCanonical: indexStatus.userCanonical || null,
    lastCrawlTime: indexStatus.lastCrawlTime || null,
  };
}

async function safeInspectUrlIndexing(fetchImpl, accessToken, siteUrl, inspectionUrl) {
  try {
    return await inspectUrlIndexing(
      fetchImpl,
      accessToken,
      siteUrl,
      inspectionUrl
    );
  } catch (error) {
    return {
      inspectionUrl,
      state: "error",
      error: error.message,
    };
  }
}

async function buildWeeklyReport({ env, now = new Date(), fetchImpl = fetch, endDate }) {
  const account = parseServiceAccount(env.GOOGLE_SERVICE_ACCOUNT_JSON_B64);
  const propertyId = normalizePropertyId(env.GA4_PROPERTY_ID);
  const siteUrl = normalizeSiteUrl(env.GSC_SITE_URL);
  const period = reportingPeriod(now, endDate);
  const accessToken = await getAccessToken(fetchImpl, account, now);
  const encodedSite = encodeURIComponent(siteUrl);
  const gscQueryUrl = `${GSC_API_ROOT}/sites/${encodedSite}/searchAnalytics/query`;
  const gaReportUrl = `${GA4_API_ROOT}/properties/${propertyId}:runReport`;
  const dateRanges = [{ startDate: period.startDate, endDate: period.endDate }];

  const [gscTotals, gscQueries, gscPages, sitemaps, gaChannels, gaOfferClicks] =
    await Promise.all([
      postJson(fetchImpl, gscQueryUrl, accessToken, { ...period, rowLimit: 1 }),
      postJson(fetchImpl, gscQueryUrl, accessToken, {
        ...period,
        dimensions: ["query"],
        rowLimit: 10,
        dataState: "final",
      }),
      postJson(fetchImpl, gscQueryUrl, accessToken, {
        ...period,
        dimensions: ["page"],
        rowLimit: 10,
        dataState: "final",
      }),
      googleRequest(
        fetchImpl,
        `${GSC_API_ROOT}/sites/${encodedSite}/sitemaps`,
        accessToken
      ),
      postJson(fetchImpl, gaReportUrl, accessToken, {
        dateRanges,
        dimensions: [{ name: "sessionDefaultChannelGroup" }],
        metrics: [
          { name: "sessions" },
          { name: "totalUsers" },
          { name: "screenPageViews" },
        ],
      }),
      postJson(fetchImpl, gaReportUrl, accessToken, {
        dateRanges,
        metrics: [{ name: "eventCount" }],
        dimensionFilter: {
          andGroup: {
            expressions: [
              {
                filter: {
                  fieldName: "eventName",
                  stringFilter: { matchType: "EXACT", value: "retailer_offer_click" },
                },
              },
              {
                filter: {
                  fieldName: "sessionDefaultChannelGroup",
                  stringFilter: { matchType: "EXACT", value: "Organic Search" },
                },
              },
            ],
          },
        },
      }),
    ]);

  const total = gscRows(gscTotals, "scope")[0] || {
    clicks: 0,
    impressions: 0,
    ctr: 0,
    position: 0,
  };
  delete total.scope;
  const channels = gaMetricRows(gaChannels);
  const organic = channels.find(
    (row) => row.sessionDefaultChannelGroup === "Organic Search"
  ) || { sessions: 0, totalUsers: 0, screenPageViews: 0 };
  const offerClicks = gaMetricRows(gaOfferClicks)[0]?.eventCount || 0;
  const topPages = gscRows(gscPages, "page");
  const inspectionTargets = buildInspectionTargets(siteUrl, topPages);
  const inspectionResults = await Promise.all(
    inspectionTargets.map((inspectionUrl) =>
      safeInspectUrlIndexing(
        fetchImpl,
        accessToken,
        siteUrl,
        inspectionUrl
      )
    )
  );
  const inspectedCount = inspectionResults.filter((item) => item.state === "ok").length;

  return {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    period,
    source: {
      ga4PropertyId: propertyId,
      gscSiteUrl: siteUrl,
      authentication: "google-service-account-readonly",
    },
    searchConsole: {
      totals: total,
      topQueries: gscRows(gscQueries, "query"),
      topPages,
      indexing: {
        inspectionTargets,
        inspectedCount,
        okCount: inspectedCount,
        errorCount: inspectionResults.length - inspectedCount,
        inspections: inspectionResults,
      },
      sitemaps: (sitemaps.sitemap || []).map((sitemap) => ({
        path: sitemap.path,
        lastSubmitted: sitemap.lastSubmitted || null,
        lastDownloaded: sitemap.lastDownloaded || null,
        isPending: sitemap.isPending === true,
        warnings: numberValue(sitemap.warnings),
        errors: numberValue(sitemap.errors),
        contents: sitemap.contents || [],
      })),
    },
    ga4: {
      organicSearch: {
        sessions: numberValue(organic.sessions),
        users: numberValue(organic.totalUsers),
        views: numberValue(organic.screenPageViews),
        retailerOfferClicks: numberValue(offerClicks),
      },
      channelRows: channels,
    },
    limitations: {
      pageIndexingTotals:
        "aggregated indexed/excluded totals are not exposed by the supported Search Console API; URL-level inspection for top pages is collected here",
      coreWebVitals:
        "not included; use Search Console UI or a separately reviewed CrUX mechanism",
      links:
        "not exposed by the supported Search Console API",
    },
  };
}

function parseEndDate(argv) {
  if (argv.length === 0) return undefined;
  if (argv.length !== 1 || !argv[0].startsWith("--end-date=")) {
    throw new Error("Usage: node scripts/growth-analytics-report.js [--end-date=YYYY-MM-DD]");
  }
  return argv[0].slice("--end-date=".length);
}

async function main() {
  const now = new Date();
  const report = await buildWeeklyReport({
    env: process.env,
    now,
    endDate: parseEndDate(process.argv.slice(2)),
  });
  fs.mkdirSync(OUTPUT_ROOT, { recursive: true });
  const outputPath = path.join(OUTPUT_ROOT, `weekly-${report.period.endDate}.json`);
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Growth analytics report written to ${path.relative(process.cwd(), outputPath)}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Growth analytics report failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  GOOGLE_SCOPES,
  OUTPUT_ROOT,
  buildWeeklyReport,
  createServiceAccountJwt,
  normalizePropertyId,
  normalizeSiteUrl,
  parseEndDate,
  parseServiceAccount,
  reportingPeriod,
};
