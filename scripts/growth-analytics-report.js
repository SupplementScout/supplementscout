const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GA4_API_ROOT = "https://analyticsdata.googleapis.com/v1beta";
const GA4_FUNNEL_API_ROOT = "https://analyticsdata.googleapis.com/v1alpha";
const GSC_API_ROOT = "https://www.googleapis.com/webmasters/v3";
const GSC_INDEXING_API_URL = "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect";
const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/webmasters.readonly",
];
const OUTPUT_ROOT = path.join(process.cwd(), "tmp", "growth-analytics");
const OPERATIONAL_SEARCH_REFERRAL = "search.google.com / referral";
const UX_PHASE1_START_DATE = "2026-10-15";
const UX_PHASE1_END_DATE = "2026-11-11";
const UX_PHASE1_EVENT_NAMES = [
  "view_category_decision_answers",
  "select_category_decision_answer",
  "add_product_to_comparison",
  "complete_two_product_comparison",
  "search",
  "select_search_result",
  "view_product",
  "retailer_offer_click",
  "save_supplement",
  "view_my_supplements",
  "return_to_my_supplements",
  "return_to_my_supplements_7d",
  "return_to_my_supplements_30d",
];

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

function safeRatio(numerator, denominator) {
  const safeNumerator = numberValue(numerator);
  const safeDenominator = numberValue(denominator);
  return safeDenominator > 0 ? safeNumerator / safeDenominator : 0;
}

function uxPhase1MeasurementPeriod(reportEndDate) {
  const requestedEnd = new Date(`${reportEndDate}T00:00:00.000Z`);
  const phaseStart = new Date(`${UX_PHASE1_START_DATE}T00:00:00.000Z`);
  const phaseEnd = new Date(`${UX_PHASE1_END_DATE}T00:00:00.000Z`);
  if (requestedEnd < phaseStart) {
    return {
      startDate: UX_PHASE1_START_DATE,
      endDate: UX_PHASE1_END_DATE,
      observedThrough: null,
      observedDays: 0,
      targetDays: 28,
      status: "NOT_STARTED",
    };
  }
  const observedEnd = requestedEnd < phaseEnd ? requestedEnd : phaseEnd;
  const observedDays = Math.floor((observedEnd - phaseStart) / 86400000) + 1;
  return {
    startDate: UX_PHASE1_START_DATE,
    endDate: UX_PHASE1_END_DATE,
    observedThrough: isoDate(observedEnd),
    observedDays,
    targetDays: 28,
    status: observedDays >= 28 ? "COMPLETE" : "COLLECTING",
  };
}

function funnelRequest(dateRanges, firstName, firstEvent, secondName, secondEvent, windowSeconds) {
  return {
    dateRanges,
    funnel: {
      isOpenFunnel: false,
      steps: [
        {
          name: firstName,
          filterExpression: { funnelEventFilter: { eventName: firstEvent } },
        },
        {
          name: secondName,
          withinDurationFromPriorStep: `${windowSeconds}s`,
          filterExpression: { funnelEventFilter: { eventName: secondEvent } },
        },
      ],
    },
  };
}

function funnelSummary(response, firstName, secondName, windowSeconds) {
  const startingUsers = funnelActiveUsers(response, firstName);
  const completingUsers = funnelActiveUsers(response, secondName);
  return {
    startingUsers,
    completingUsers,
    userCompletionRate: safeRatio(completingUsers, startingUsers),
    windowSeconds,
  };
}

function buildUxMeasurement(period, eventResponse, funnels) {
  const rows = period.status === "NOT_STARTED" ? [] : gaMetricRows(eventResponse);
  const metric = (eventName, key) => numberValue(rows.find((row) => row.eventName === eventName)?.[key]);
  const eventCounts = Object.fromEntries(
    UX_PHASE1_EVENT_NAMES.map((eventName) => [eventName, {
      events: metric(eventName, "eventCount"),
      users: metric(eventName, "totalUsers"),
    }])
  );
  const emptyFunnel = {};
  const usable = period.status === "NOT_STARTED" ? emptyFunnel : funnels;
  return {
    period,
    eventCounts,
    categoryDecision: funnelSummary(usable.categoryDecision, "Decision answers viewed", "Decision answer selected", 1800),
    comparison: funnelSummary(usable.comparison, "Comparison started", "Comparison completed", 1800),
    searchToProduct: funnelSummary(usable.searchToProduct, "Search performed", "Search result selected", 1800),
    productToRetailer: funnelSummary(usable.productToRetailer, "Product viewed", "Retailer offer clicked", 1800),
    mySupplementsToRetailer: funnelSummary(usable.mySupplementsToRetailer, "My Supplements viewed", "Retailer offer clicked", 1800),
    saveToReturn7Days: funnelSummary(usable.saveToReturn7Days, "Supplement saved", "My Supplements return", 604800),
    saveToReturn30Days: funnelSummary(usable.saveToReturn30Days, "Supplement saved", "My Supplements return", 2592000),
    limitations: [
      "Only consented GA4 activity is counted; absence of an event is not proof that no user completed the action.",
      "Funnel users are same-GA4-user sequences, not account identities, and do not provide cross-device attribution.",
      "Seven- and 30-day save-to-return rates remain right-censored until every save has had the full observation window; threshold return events are reported separately.",
      "The search funnel uses the explicit search-result selection event added for this measurement window; it does not infer navigation from page views.",
    ],
  };
}

function funnelActiveUsers(response, stepName) {
  const report = response?.funnelTable || {};
  const dimensionNames = (report.dimensionHeaders || []).map((item) => item.name);
  const metricNames = (report.metricHeaders || []).map((item) => item.name);
  const stepIndex = dimensionNames.indexOf("funnelStepName");
  const usersIndex = metricNames.indexOf("activeUsers");
  if (stepIndex < 0 || usersIndex < 0) return 0;

  const row = (report.rows || []).find((item) => {
    const value = item.dimensionValues?.[stepIndex]?.value || "";
    return value === stepName || value.endsWith(`. ${stepName}`);
  });
  return numberValue(row?.metricValues?.[usersIndex]?.value);
}

function gscRows(response, keyName) {
  return gscDimensionRows(response, [keyName]);
}

function gscDimensionRows(response, keyNames) {
  return (response.rows || []).map((row) => ({
    ...Object.fromEntries(
      keyNames.map((keyName, index) => [keyName, row.keys?.[index] || ""])
    ),
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

async function safeGoogleEvidence(request, unavailableReason) {
  try {
    return { state: "available", response: await request() };
  } catch (error) {
    return {
      state: "unavailable",
      error: `${unavailableReason}: ${error.message}`,
    };
  }
}

function dateRangeDays(period) {
  const days = [];
  const cursor = new Date(`${period.startDate}T00:00:00.000Z`);
  const end = new Date(`${period.endDate}T00:00:00.000Z`);
  while (cursor <= end) {
    days.push(isoDate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

function sumRows(rows, key) {
  return rows.reduce((total, row) => total + numberValue(row[key]), 0);
}

function conservativeExternalSearchSignal(totalOrganicSessions, sourceMediumRows) {
  const excludedRows = sourceMediumRows.filter(
    (row) => row.sessionSourceMedium === OPERATIONAL_SEARCH_REFERRAL
  );
  const excludedSessions = sumRows(excludedRows, "sessions");
  return {
    sessions: Math.max(0, numberValue(totalOrganicSessions) - excludedSessions),
    excludedSessions,
    excludedSourceRowUsers: sumRows(excludedRows, "totalUsers"),
    excludedSourceMedium: OPERATIONAL_SEARCH_REFERRAL,
    excludedSourceObserved: excludedRows.length > 0,
    basis:
      "GA4 Organic Search sessions minus search.google.com / referral sessions; original GA4 totals remain unchanged and the remainder is not proof that every session is external.",
  };
}

function renderSafeSummary(report) {
  const betterValue = report.ga4.betterValueAlternatives;
  const trafficQuality = report.ga4.organicTrafficQuality;
  const externalSignal = trafficQuality.conservativeExternalSearchSignal;
  const sitemapErrors = report.searchConsole.sitemaps.reduce(
    (total, sitemap) => total + numberValue(sitemap.errors),
    0
  );
  const ux = report.ga4.uxRetentionPhase1;

  return [
    "## Weekly Growth Analytics",
    `- Period: ${report.period.startDate} to ${report.period.endDate}`,
    `- GSC: ${report.searchConsole.totals.clicks} clicks, ${report.searchConsole.totals.impressions} impressions`,
    `- GSC completeness: ${report.searchConsole.dailyCompleteness.status}`,
    `- GA4 organic: ${report.ga4.organicSearch.sessions} sessions, ${report.ga4.organicSearch.retailerOfferClicks} retailer-offer clicks`,
    `- GA4 conservative external-search signal: ${externalSignal.sessions} sessions (${externalSignal.excludedSessions} operational referral sessions excluded)`,
    `- GA4 hostnames: ${trafficQuality.hostnameRows.map((row) => row.hostName).join(", ")}`,
    `- GA4 configured data filters: ${trafficQuality.dataFilterConfiguration.state}`,
    `- Better-value: ${betterValue.impressions} impressions, ${betterValue.clicks} clicks, ${(betterValue.clickThroughRate * 100).toFixed(2)}% CTR`,
    `- Better-value downstream: ${betterValue.downstreamRetailerClickUsers}/${betterValue.selectingUsers} users within 30 minutes`,
    `- UX Phase 1 window: ${ux.period.status}, ${ux.period.observedDays}/${ux.period.targetDays} days`,
    `- UX decision users: ${ux.categoryDecision.completingUsers}/${ux.categoryDecision.startingUsers}`,
    `- UX search-to-product users: ${ux.searchToProduct.completingUsers}/${ux.searchToProduct.startingUsers}`,
    `- UX save-to-return users (7-day observation): ${ux.saveToReturn7Days.completingUsers}/${ux.saveToReturn7Days.startingUsers}`,
    `- Sitemap errors: ${sitemapErrors}`,
    `- Index inspections: ${report.searchConsole.indexing.inspectedCount}/${report.searchConsole.indexing.inspectionTargets.length} requested URLs`,
  ].join("\n");
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
  const uxPeriod = uxPhase1MeasurementPeriod(period.endDate);
  const accessToken = await getAccessToken(fetchImpl, account, now);
  const encodedSite = encodeURIComponent(siteUrl);
  const gscQueryUrl = `${GSC_API_ROOT}/sites/${encodedSite}/searchAnalytics/query`;
  const gaReportUrl = `${GA4_API_ROOT}/properties/${propertyId}:runReport`;
  const gaFunnelUrl = `${GA4_FUNNEL_API_ROOT}/properties/${propertyId}:runFunnelReport`;
  const dateRanges = [{ startDate: period.startDate, endDate: period.endDate }];
  const uxDateRanges = [{
    startDate: uxPeriod.observedThrough ? uxPeriod.startDate : period.startDate,
    endDate: uxPeriod.observedThrough || period.endDate,
  }];

  const [gscTotals, gscQueries, gscDailyFinal, gscDailyAll, gscPages, gscPageQueries, sitemaps, gaChannels, gaOfferClicks, gaBetterValueEvents, gaBetterValueFunnel, gaUxEvents, gaDecisionFunnel, gaComparisonFunnel, gaSearchToProductFunnel, gaProductToRetailerFunnel, gaMySupplementsToRetailerFunnel, gaSaveToReturn7DaysFunnel, gaSaveToReturn30DaysFunnel, gaOrganicDaily, gaOrganicHostnames, gaOrganicCountries, gaOrganicSources, gaTestFilters] =
    await Promise.all([
      postJson(fetchImpl, gscQueryUrl, accessToken, { ...period, rowLimit: 1, dataState: "final" }),
      postJson(fetchImpl, gscQueryUrl, accessToken, {
        ...period,
        dimensions: ["query"],
        rowLimit: 100,
        dataState: "final",
      }),
      postJson(fetchImpl, gscQueryUrl, accessToken, {
        ...period,
        dimensions: ["date"],
        rowLimit: 100,
        dataState: "final",
      }),
      postJson(fetchImpl, gscQueryUrl, accessToken, {
        ...period,
        dimensions: ["date"],
        rowLimit: 100,
        dataState: "all",
      }),
      postJson(fetchImpl, gscQueryUrl, accessToken, {
        ...period,
        dimensions: ["page"],
        rowLimit: 100,
        dataState: "final",
      }),
      postJson(fetchImpl, gscQueryUrl, accessToken, {
        ...period,
        dimensions: ["page", "query"],
        rowLimit: 250,
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
      postJson(fetchImpl, gaReportUrl, accessToken, {
        dateRanges,
        dimensions: [{ name: "eventName" }],
        metrics: [{ name: "eventCount" }],
        dimensionFilter: {
          filter: {
            fieldName: "eventName",
            inListFilter: {
              values: [
                "view_better_value_alternatives",
                "select_better_value_alternative",
              ],
            },
          },
        },
      }),
      postJson(fetchImpl, gaFunnelUrl, accessToken, {
        dateRanges,
        funnel: {
          isOpenFunnel: false,
          steps: [
            {
              name: "Alternative selected",
              filterExpression: {
                funnelEventFilter: {
                  eventName: "select_better_value_alternative",
                },
              },
            },
            {
              name: "Retailer offer clicked",
              withinDurationFromPriorStep: "1800s",
              filterExpression: {
                funnelEventFilter: { eventName: "retailer_offer_click" },
              },
            },
          ],
        },
      }),
      postJson(fetchImpl, gaReportUrl, accessToken, {
        dateRanges: uxDateRanges,
        dimensions: [{ name: "eventName" }],
        metrics: [{ name: "eventCount" }, { name: "totalUsers" }],
        dimensionFilter: {
          filter: {
            fieldName: "eventName",
            inListFilter: { values: UX_PHASE1_EVENT_NAMES },
          },
        },
      }),
      postJson(fetchImpl, gaFunnelUrl, accessToken, funnelRequest(uxDateRanges, "Decision answers viewed", "view_category_decision_answers", "Decision answer selected", "select_category_decision_answer", 1800)),
      postJson(fetchImpl, gaFunnelUrl, accessToken, funnelRequest(uxDateRanges, "Comparison started", "add_product_to_comparison", "Comparison completed", "complete_two_product_comparison", 1800)),
      postJson(fetchImpl, gaFunnelUrl, accessToken, funnelRequest(uxDateRanges, "Search performed", "search", "Search result selected", "select_search_result", 1800)),
      postJson(fetchImpl, gaFunnelUrl, accessToken, funnelRequest(uxDateRanges, "Product viewed", "view_product", "Retailer offer clicked", "retailer_offer_click", 1800)),
      postJson(fetchImpl, gaFunnelUrl, accessToken, funnelRequest(uxDateRanges, "My Supplements viewed", "view_my_supplements", "Retailer offer clicked", "retailer_offer_click", 1800)),
      postJson(fetchImpl, gaFunnelUrl, accessToken, funnelRequest(uxDateRanges, "Supplement saved", "save_supplement", "My Supplements return", "return_to_my_supplements", 604800)),
      postJson(fetchImpl, gaFunnelUrl, accessToken, funnelRequest(uxDateRanges, "Supplement saved", "save_supplement", "My Supplements return", "return_to_my_supplements", 2592000)),
      postJson(fetchImpl, gaReportUrl, accessToken, {
        dateRanges,
        dimensions: [{ name: "date" }],
        metrics: [{ name: "sessions" }, { name: "totalUsers" }, { name: "screenPageViews" }],
        dimensionFilter: { filter: { fieldName: "sessionDefaultChannelGroup", stringFilter: { matchType: "EXACT", value: "Organic Search" } } },
      }),
      postJson(fetchImpl, gaReportUrl, accessToken, {
        dateRanges,
        dimensions: [{ name: "hostName" }],
        metrics: [{ name: "sessions" }, { name: "totalUsers" }],
        dimensionFilter: { filter: { fieldName: "sessionDefaultChannelGroup", stringFilter: { matchType: "EXACT", value: "Organic Search" } } },
      }),
      postJson(fetchImpl, gaReportUrl, accessToken, {
        dateRanges,
        dimensions: [{ name: "country" }],
        metrics: [{ name: "sessions" }, { name: "totalUsers" }],
        dimensionFilter: { filter: { fieldName: "sessionDefaultChannelGroup", stringFilter: { matchType: "EXACT", value: "Organic Search" } } },
      }),
      postJson(fetchImpl, gaReportUrl, accessToken, {
        dateRanges,
        dimensions: [{ name: "sessionSourceMedium" }],
        metrics: [{ name: "sessions" }, { name: "totalUsers" }],
        dimensionFilter: { filter: { fieldName: "sessionDefaultChannelGroup", stringFilter: { matchType: "EXACT", value: "Organic Search" } } },
      }),
      safeGoogleEvidence(
        () => postJson(fetchImpl, gaReportUrl, accessToken, {
          dateRanges,
          dimensions: [{ name: "testDataFilterName" }],
          metrics: [{ name: "sessions" }, { name: "totalUsers" }],
          dimensionFilter: { filter: { fieldName: "sessionDefaultChannelGroup", stringFilter: { matchType: "EXACT", value: "Organic Search" } } },
        }),
        "GA4 test-filter dimension unavailable"
      ),
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
  const organicSourceMediumRows = gaMetricRows(gaOrganicSources);
  const externalSearchSignal = conservativeExternalSearchSignal(
    organic.sessions,
    organicSourceMediumRows
  );
  const offerClicks = gaMetricRows(gaOfferClicks)[0]?.eventCount || 0;
  const betterValueEvents = gaMetricRows(gaBetterValueEvents);
  const betterValueImpressions =
    betterValueEvents.find(
      (row) => row.eventName === "view_better_value_alternatives"
    )?.eventCount || 0;
  const betterValueClicks =
    betterValueEvents.find(
      (row) => row.eventName === "select_better_value_alternative"
    )?.eventCount || 0;
  const selectingUsers = funnelActiveUsers(
    gaBetterValueFunnel,
    "Alternative selected"
  );
  const downstreamRetailerClickUsers = funnelActiveUsers(
    gaBetterValueFunnel,
    "Retailer offer clicked"
  );
  const topPages = gscRows(gscPages, "page");
  const pageQueryRows = gscDimensionRows(gscPageQueries, ["page", "query"]);
  const opportunities = pageQueryRows
    .filter((row) => row.clicks === 0 && row.impressions > 0)
    .sort(
      (left, right) =>
        right.impressions - left.impressions ||
        left.position - right.position ||
        left.page.localeCompare(right.page) ||
        left.query.localeCompare(right.query)
    )
    .slice(0, 100);
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
  const dailyFinalRows = gscRows(gscDailyFinal, "date");
  const dailyAllRows = gscRows(gscDailyAll, "date");
  const observedFinalDates = new Set(dailyFinalRows.map((row) => row.date));
  const requestedDates = dateRangeDays(period);
  const firstIncompleteDate = gscDailyAll.metadata?.first_incomplete_date || null;
  const finalImpressions = sumRows(dailyFinalRows, "impressions");
  const allImpressions = sumRows(dailyAllRows, "impressions");
  const finalClicks = sumRows(dailyFinalRows, "clicks");
  const allClicks = sumRows(dailyAllRows, "clicks");
  const completenessStatus = firstIncompleteDate
    ? "INCOMPLETE_FROM_REPORTED_DATE"
    : (finalImpressions !== allImpressions || finalClicks !== allClicks)
      ? "FINAL_AND_ALL_DIFFER_WITHOUT_METADATA"
      : "NO_INCOMPLETE_DATA_REPORTED";
  const testFilterRows = gaTestFilters.state === "available"
    ? gaMetricRows(gaTestFilters.response)
    : [];
  const uxMeasurement = buildUxMeasurement(uxPeriod, gaUxEvents, {
    categoryDecision: gaDecisionFunnel,
    comparison: gaComparisonFunnel,
    searchToProduct: gaSearchToProductFunnel,
    productToRetailer: gaProductToRetailerFunnel,
    mySupplementsToRetailer: gaMySupplementsToRetailerFunnel,
    saveToReturn7Days: gaSaveToReturn7DaysFunnel,
    saveToReturn30Days: gaSaveToReturn30DaysFunnel,
  });

  return {
    schemaVersion: 6,
    generatedAt: now.toISOString(),
    period,
    source: {
      ga4PropertyId: propertyId,
      gscSiteUrl: siteUrl,
      authentication: "google-service-account-readonly",
    },
    searchConsole: {
      totals: total,
      dailyCompleteness: {
        status: completenessStatus,
        firstIncompleteDate,
        requestedDates,
        datesWithFinalActivity: [...observedFinalDates].sort(),
        datesWithoutFinalActivity: requestedDates.filter((date) => !observedFinalDates.has(date)),
        finalRows: dailyFinalRows,
        allRows: dailyAllRows,
        finalTotals: { clicks: finalClicks, impressions: finalImpressions },
        allTotals: { clicks: allClicks, impressions: allImpressions },
      },
      topQueries: gscRows(gscQueries, "query"),
      topPages,
      pageQueryRows,
      opportunities,
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
      organicTrafficQuality: {
        dailyRows: gaMetricRows(gaOrganicDaily),
        hostnameRows: gaMetricRows(gaOrganicHostnames),
        countryRows: gaMetricRows(gaOrganicCountries),
        sourceMediumRows: organicSourceMediumRows,
        conservativeExternalSearchSignal: externalSearchSignal,
        testDataFilterEvidence: gaTestFilters.state === "available"
          ? { state: "available", rows: testFilterRows }
          : gaTestFilters,
        dataFilterConfiguration: {
          state: "not_exposed_by_supported_api",
          note: "The supported Analytics Admin API does not expose property data-filter configuration; testDataFilterName covers testing-state filters only.",
        },
      },
      betterValueAlternatives: {
        impressions: numberValue(betterValueImpressions),
        clicks: numberValue(betterValueClicks),
        clickThroughRate: safeRatio(
          betterValueClicks,
          betterValueImpressions
        ),
        selectingUsers,
        downstreamRetailerClickUsers,
        downstreamRetailerClickThroughRate: safeRatio(
          downstreamRetailerClickUsers,
          selectingUsers
        ),
        downstreamWindowMinutes: 30,
      },
      uxRetentionPhase1: uxMeasurement,
      channelRows: channels,
    },
    limitations: {
      pageIndexingTotals:
        "aggregated indexed/excluded totals are not exposed by the supported Search Console API; URL-level inspection for top pages is collected here",
      coreWebVitals:
        "not included; use Search Console UI or a separately reviewed CrUX mechanism",
      links:
        "not exposed by the supported Search Console API",
      queryPrivacy:
        "Search Console may omit anonymized or very low-volume queries; page-query rows will not necessarily sum to site totals",
      trafficQuality:
        "hostname, country, source/medium and GA4 data-filter evidence can reveal obvious contamination but cannot prove that every remaining user is external",
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
  buildUxMeasurement,
  conservativeExternalSearchSignal,
  createServiceAccountJwt,
  normalizePropertyId,
  normalizeSiteUrl,
  parseEndDate,
  parseServiceAccount,
  renderSafeSummary,
  reportingPeriod,
  safeRatio,
  uxPhase1MeasurementPeriod,
};
