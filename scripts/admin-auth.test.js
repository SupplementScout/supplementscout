const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");
const fs = require("fs");
const Module = require("module");
const path = require("path");
const test = require("node:test");
const ts = require("typescript");

function loadTsModule(relativePath) {
  const filename = path.join(process.cwd(), relativePath);
  const source = fs.readFileSync(filename, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  const mod = new Module(filename, module);

  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(outputText, filename);

  return mod.exports;
}

const originalTsLoader = require.extensions[".ts"];
const originalModuleLoad = Module._load;

require.extensions[".ts"] = function loadTypeScriptModule(mod, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });

  mod._compile(outputText, filename);
};

Module._load = function loadModule(request, parent, isMain) {
  if (request === "server-only") {
    return {};
  }

  return originalModuleLoad.call(this, request, parent, isMain);
};

function requireFreshTsModule(relativePath) {
  const filename = path.join(process.cwd(), relativePath);

  delete require.cache[require.resolve(filename)];

  return require(filename);
}

test.after(() => {
  if (originalTsLoader) {
    require.extensions[".ts"] = originalTsLoader;
  } else {
    delete require.extensions[".ts"];
  }

  Module._load = originalModuleLoad;
});

const {
  ADMIN_SESSION_COOKIE_NAME,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSessionCookieValue,
  getAdminAccessDecision,
  getAdminSessionCookieOptions,
  isAdminPasswordValid,
  validateAdminSessionCookieValue,
} = loadTsModule("app/lib/adminAuthCore.ts");

const { getDuplicatePairIds } = loadTsModule("app/lib/duplicates.ts");
const {
  findPotentialDuplicate,
  productNameSimilarity,
} = loadTsModule("app/lib/productMatchGuard.ts");

const nowMs = Date.now();
const secret = "test-session-secret";
const adminToken = "test-admin-password";

function validCookie() {
  return createAdminSessionCookieValue({ secret, nowMs });
}

function signedCookie(payload, cookieSecret = secret) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", cookieSecret)
    .update(encodedPayload)
    .digest("base64url");

  return `${encodedPayload}.${signature}`;
}

async function withEnv(values, callback) {
  const previous = {};

  for (const [key, value] of Object.entries(values)) {
    previous[key] = process.env[key];

    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await callback();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

function loginRequest(password) {
  return new Request("https://supplementscout.test/admin/login/session", {
    method: "POST",
    body: new URLSearchParams({ password }),
  });
}

function logoutRequest(cookieValue) {
  return {
    url: "https://supplementscout.test/admin/logout",
    cookies: {
      get(name) {
        return name === ADMIN_SESSION_COOKIE_NAME
          ? { name, value: cookieValue }
          : undefined;
      },
    },
  };
}

test("unauthenticated admin page request is blocked", () => {
  assert.equal(
    getAdminAccessDecision({
      pathname: "/admin/duplicates",
      method: "GET",
      cookieValue: undefined,
      secret,
    }),
    "redirect"
  );
});

test("unauthenticated admin POST request is blocked", () => {
  assert.equal(
    getAdminAccessDecision({
      pathname: "/admin/duplicates/merge",
      method: "POST",
      cookieValue: undefined,
      secret,
    }),
    "unauthorized"
  );
});

test("valid login creates an authenticated session cookie", () => {
  assert.equal(isAdminPasswordValid(adminToken, adminToken), true);

  const cookie = validCookie();
  const result = validateAdminSessionCookieValue(cookie, { secret, nowMs });

  assert.equal(result.ok, true);
  assert.equal(cookie.includes(adminToken), false);
});

test("invalid password does not create a cookie", () => {
  assert.equal(isAdminPasswordValid("wrong-password", adminToken), false);
});

test("missing ADMIN_TOKEN fails closed", () => {
  assert.equal(isAdminPasswordValid(adminToken, undefined), false);
  assert.equal(isAdminPasswordValid(adminToken, ""), false);
});

test("expired cookie is rejected", () => {
  const cookie = validCookie();
  const result = validateAdminSessionCookieValue(cookie, {
    secret,
    nowMs: nowMs + ADMIN_SESSION_MAX_AGE_SECONDS * 1000 + 1,
  });

  assert.deepEqual(result, { ok: false, reason: "expired" });
});

test("wrong cookie version is rejected", () => {
  const cookie = signedCookie({
    v: 2,
    exp: nowMs + ADMIN_SESSION_MAX_AGE_SECONDS * 1000,
  });
  const result = validateAdminSessionCookieValue(cookie, { secret, nowMs });

  assert.deepEqual(result, { ok: false, reason: "wrong_version" });
});

test("generic malformed cookie is rejected", () => {
  assert.deepEqual(
    validateAdminSessionCookieValue("not-a-cookie", { secret, nowMs }),
    { ok: false, reason: "malformed_cookie" }
  );
});

test("modified cookie payload is rejected", () => {
  const cookie = validCookie();
  const [payload, signature] = cookie.split(".");
  const changedPayload = Buffer.from(
    JSON.stringify({ v: 1, exp: nowMs + 10_000_000 })
  ).toString("base64url");
  const result = validateAdminSessionCookieValue(
    `${changedPayload}.${signature}`,
    { secret, nowMs }
  );

  assert.notEqual(changedPayload, payload);
  assert.deepEqual(result, { ok: false, reason: "bad_signature" });
});

test("modified signature is rejected", () => {
  const cookie = validCookie();
  const [payload] = cookie.split(".");
  const result = validateAdminSessionCookieValue(`${payload}.bad-signature`, {
    secret,
    nowMs,
  });

  assert.deepEqual(result, { ok: false, reason: "bad_signature" });
});

test("missing ADMIN_SESSION_SECRET fails safely", () => {
  assert.throws(
    () => createAdminSessionCookieValue({ secret: undefined, nowMs }),
    /ADMIN_SESSION_SECRET/
  );
  assert.deepEqual(validateAdminSessionCookieValue(validCookie(), {
    secret: undefined,
    nowMs,
  }), { ok: false, reason: "missing_secret" });
});

test("authenticated request reaches the admin route", () => {
  assert.equal(
    getAdminAccessDecision({
      pathname: "/admin/duplicates",
      method: "GET",
      cookieValue: validCookie(),
      secret,
    }),
    "allow"
  );
  assert.equal(
    getAdminAccessDecision({
      pathname: "/admin/catalog-health",
      method: "GET",
      cookieValue: validCookie(),
      secret,
    }),
    "allow"
  );
});

test("proxy allows only exact admin login routes without a session", () => {
  assert.equal(
    getAdminAccessDecision({
      pathname: "/admin/login",
      method: "GET",
      cookieValue: undefined,
      secret,
    }),
    "allow"
  );
  assert.equal(
    getAdminAccessDecision({
      pathname: "/admin/login/session",
      method: "POST",
      cookieValue: undefined,
      secret,
    }),
    "allow"
  );
  assert.equal(
    getAdminAccessDecision({
      pathname: "/admin/login/anything",
      method: "GET",
      cookieValue: undefined,
      secret,
    }),
    "redirect"
  );
  assert.equal(
    getAdminAccessDecision({
      pathname: "/admin/login/session/anything",
      method: "GET",
      cookieValue: undefined,
      secret,
    }),
    "redirect"
  );
});

test("logout clears the cookie with the admin cookie settings", () => {
  const options = getAdminSessionCookieOptions(true);

  assert.equal(ADMIN_SESSION_COOKIE_NAME, "__ss_admin_session");
  assert.equal(options.httpOnly, true);
  assert.equal(options.secure, true);
  assert.equal(options.sameSite, "lax");
  assert.equal(options.path, "/admin");
  assert.equal(options.maxAge, ADMIN_SESSION_MAX_AGE_SECONDS);
});

test("actual invalid login route response does not set a session cookie", async () => {
  await withEnv(
    {
      ADMIN_TOKEN: adminToken,
      ADMIN_SESSION_SECRET: secret,
      NODE_ENV: "production",
    },
    async () => {
      const { POST } = requireFreshTsModule("app/admin/login/session/route.ts");
      const response = await POST(loginRequest("wrong-password"));

      assert.equal(response.status, 303);
      assert.equal(response.headers.get("set-cookie"), null);
      assert.equal(
        response.headers.get("location"),
        "https://supplementscout.test/admin/login?error=1"
      );
    }
  );
});

test("actual valid login route response sets the secure admin session cookie", async () => {
  await withEnv(
    {
      ADMIN_TOKEN: adminToken,
      ADMIN_SESSION_SECRET: secret,
      NODE_ENV: "production",
    },
    async () => {
      const { POST } = requireFreshTsModule("app/admin/login/session/route.ts");
      const response = await POST(loginRequest(adminToken));
      const setCookie = response.headers.get("set-cookie") || "";

      assert.equal(response.status, 303);
      assert.match(setCookie, new RegExp(`^${ADMIN_SESSION_COOKIE_NAME}=`));
      assert.match(setCookie, /HttpOnly/i);
      assert.match(setCookie, /Path=\/admin/i);
      assert.match(setCookie, /Max-Age=28800/i);
      assert.match(setCookie, /SameSite=Lax/i);
      assert.match(setCookie, /Secure/i);
      assert.equal(setCookie.includes(adminToken), false);
    }
  );
});

test("actual logout route clears the same admin session cookie", async () => {
  await withEnv(
    {
      ADMIN_SESSION_SECRET: secret,
      NODE_ENV: "production",
    },
    async () => {
      const { POST } = requireFreshTsModule("app/admin/logout/route.ts");
      const response = await POST(logoutRequest(validCookie()));
      const setCookie = response.headers.get("set-cookie") || "";

      assert.equal(response.status, 303);
      assert.match(setCookie, new RegExp(`^${ADMIN_SESSION_COOKIE_NAME}=`));
      assert.match(setCookie, /Path=\/admin/i);
      assert.match(setCookie, /Max-Age=0/i);
    }
  );
});

test("raw ADMIN_TOKEN is never stored in the cookie", () => {
  assert.equal(validCookie().includes(adminToken), false);
});

test("query-string token alone no longer grants admin read access", () => {
  assert.equal(
    getAdminAccessDecision({
      pathname: "/admin/duplicates",
      method: "GET",
      cookieValue: undefined,
      secret,
    }),
    "redirect"
  );
});

test("no Supabase query runs before authentication on protected pages", () => {
  const duplicatePageSource = fs.readFileSync(
    path.join(process.cwd(), "app", "admin", "duplicates", "page.tsx"),
    "utf8"
  );
  const mergePreviewSource = fs.readFileSync(
    path.join(
      process.cwd(),
      "app",
      "admin",
      "duplicates",
      "merge-preview",
      "page.tsx"
    ),
    "utf8"
  );
  const outboundClicksSource = fs.readFileSync(
    path.join(process.cwd(), "app", "admin", "outbound-clicks", "page.tsx"),
    "utf8"
  );
  const catalogHealthSource = fs.readFileSync(
    path.join(process.cwd(), "app", "admin", "catalog-health", "page.tsx"),
    "utf8"
  );
  const productMatchingSource = fs.readFileSync(
    path.join(process.cwd(), "app", "admin", "product-matching", "page.tsx"),
    "utf8"
  );

  assert(
    duplicatePageSource.indexOf("await requireAdminPage()") <
      duplicatePageSource.indexOf(".from(")
  );
  assert(
    mergePreviewSource.indexOf("await requireAdminPage()") <
      mergePreviewSource.indexOf("getMergePreview(")
  );
  assert(
    outboundClicksSource.indexOf("await requireAdminPage()") <
      outboundClicksSource.indexOf('await import("../lib/outboundClicksReport")')
  );
  assert(
    catalogHealthSource.indexOf("await requireAdminPage()") <
      catalogHealthSource.indexOf('await import("../lib/catalogHealth")')
  );
  assert(
    productMatchingSource.indexOf("await requireAdminPage()") <
      productMatchingSource.indexOf(".from(")
  );
});

test("duplicate admin pages do not render raw error messages", () => {
  const duplicatePageSource = fs.readFileSync(
    path.join(process.cwd(), "app", "admin", "duplicates", "page.tsx"),
    "utf8"
  );
  const mergePreviewSource = fs.readFileSync(
    path.join(
      process.cwd(),
      "app",
      "admin",
      "duplicates",
      "merge-preview",
      "page.tsx"
    ),
    "utf8"
  );

  assert.equal(duplicatePageSource.includes("{error.message}"), false);
  assert.equal(duplicatePageSource.includes("{ignoredPairsError.message}"), false);
  assert.equal(duplicatePageSource.includes("{ignoredProductsError.message}"), false);
  assert.equal(mergePreviewSource.includes("error.message"), false);
  assert(duplicatePageSource.includes("Unable to load duplicate products."));
  assert(mergePreviewSource.includes("Unable to prepare merge preview."));
});

test("merge and duplicate decision routes authenticate before parsing, queries, and writes", () => {
  const routeSources = [
    {
      name: "ignore",
      source: fs.readFileSync(
        path.join(process.cwd(), "app", "admin", "duplicates", "ignore", "route.ts"),
        "utf8"
      ),
      orderedMarkers: ["requireAdminRoute(request)", "request.formData()", "supabaseAdmin"],
      writeMarker: ".upsert(",
    },
    {
      name: "defer",
      source: fs.readFileSync(
        path.join(process.cwd(), "app", "admin", "duplicates", "defer", "route.ts"),
        "utf8"
      ),
      orderedMarkers: ["requireAdminRoute(request)", "request.formData()", "supabaseAdmin"],
      writeMarker: ".upsert(",
    },
    {
      name: "batch",
      source: fs.readFileSync(
        path.join(process.cwd(), "app", "admin", "duplicates", "batch", "route.ts"),
        "utf8"
      ),
      orderedMarkers: ["requireAdminRoute(request)", "request.formData()", "supabaseAdmin"],
      writeMarker: ".upsert(",
    },
    {
      name: "restore",
      source: fs.readFileSync(
        path.join(process.cwd(), "app", "admin", "duplicates", "restore", "route.ts"),
        "utf8"
      ),
      orderedMarkers: ["requireAdminRoute(request)", "request.formData()", "supabaseAdmin"],
      writeMarker: ".delete()",
    },
    {
      name: "merge",
      source: fs.readFileSync(
        path.join(process.cwd(), "app", "admin", "duplicates", "merge", "route.ts"),
        "utf8"
      ),
      orderedMarkers: [
        "requireAdminRoute(request)",
        "request.formData()",
        "getMergePreview(",
        "supabaseAdmin.rpc",
      ],
      writeMarker: "supabaseAdmin.rpc",
    },
    {
      name: "product matching decision",
      source: fs.readFileSync(
        path.join(
          process.cwd(),
          "app",
          "admin",
          "product-matching",
          "decision",
          "route.ts"
        ),
        "utf8"
      ),
      orderedMarkers: ["requireAdminRoute(request)", "request.formData()", "supabaseAdmin"],
      writeMarker: ".update(",
    },
    {
      name: "product matching reopen",
      source: fs.readFileSync(
        path.join(
          process.cwd(),
          "app",
          "admin",
          "product-matching",
          "reopen",
          "route.ts"
        ),
        "utf8"
      ),
      orderedMarkers: ["requireAdminRoute(request)", "request.formData()", "supabaseAdmin"],
      writeMarker: ".update(",
    },
  ];

  for (const route of routeSources) {
    const postSource = route.source.slice(route.source.indexOf("export async function POST"));
    const authIndex = postSource.indexOf(route.orderedMarkers[0]);

    assert(authIndex >= 0, `${route.name} route should authenticate`);
    for (const marker of route.orderedMarkers.slice(1)) {
      const markerIndex = postSource.indexOf(marker);

      assert(markerIndex >= 0, `${route.name} route should contain ${marker}`);
      assert(authIndex < markerIndex, `${route.name} route should auth before ${marker}`);
    }

    assert(
      authIndex < postSource.indexOf(route.writeMarker),
      `${route.name} route should authenticate before writes`
    );
  }
});

test("simple and decision-based merges require server-verifiable confirmation", () => {
  const mergeRouteSource = fs.readFileSync(
    path.join(process.cwd(), "app", "admin", "duplicates", "merge", "route.ts"),
    "utf8"
  );
  const confirmButtonSource = fs.readFileSync(
    path.join(
      process.cwd(),
      "app",
      "admin",
      "duplicates",
      "merge-preview",
      "MergeConfirmButton.tsx"
    ),
    "utf8"
  );

  assert.match(
    mergeRouteSource,
    /if\s*\(!canMerge\s*\|\|\s*!hasConfirmation\(confirmation,\s*candidateId\)\)/
  );
  assert.match(confirmButtonSource, /name="confirmation"/);
  assert.match(confirmButtonSource, /confirmationInputRef\.current\.value = confirmed/);
});

test("existing bigint ID handling remains string-safe", () => {
  const hugeA = "90071992547409931234";
  const hugeB = "80000000000000000001";

  assert.deepEqual(getDuplicatePairIds(hugeA, hugeB), [hugeB, hugeA]);
});

test("full-catalog guard catches Animal and Universal Nutrition wording", () => {
  assert(productNameSimilarity(
    "Universal Nutrition Animal Flex Joint Care 44 Packs",
    "Animal Flex 44 packs"
  ) >= 0.64);
  const match = findPotentialDuplicate(
    "Universal Nutrition Animal Flex Joint Care 44 Packs",
    [{ id: "956", name: "Animal Flex 44 packs" }],
    [{ product_id: "956", external_name: "Animal Flex 44 packs" }]
  );
  assert.equal(match.productId, "956");
});

test("catalog search authenticates before parsing and database queries", () => {
  const source = fs.readFileSync(
    path.join(
      process.cwd(),
      "app",
      "admin",
      "product-matching",
      "catalog-search",
      "route.ts"
    ),
    "utf8"
  );
  const getSource = source.slice(source.indexOf("export async function GET"));
  const auth = getSource.indexOf("requireAdminRoute(request)");
  assert(auth >= 0);
  assert(auth < getSource.indexOf("new URL(request.url)"));
  assert(auth < getSource.indexOf("supabaseAdmin"));
});

test("new-product decisions require full-catalog confirmation and manual search is validated", () => {
  const source = fs.readFileSync(
    path.join(
      process.cwd(),
      "app",
      "admin",
      "product-matching",
      "decision",
      "route.ts"
    ),
    "utf8"
  );
  assert.match(source, /confirmNewProduct !== "yes"/);
  assert.match(source, /loadPotentialDuplicate\(reviewItem\.product_title\)/);
  assert.match(source, /APPROVE_EXISTING_VARIANT_MANUAL/);
  assert.match(source, /APPROVE_NEW_VARIANT_SEED_EXISTING_MANUAL/);
  assert.match(source, /variant\.product_id\) !== selectedProductId/);
});

test("automation review queue is admin-only, paginated and exposes bounded evidence without catalogue writes", () => {
  const page = fs.readFileSync(path.join(process.cwd(), "app", "admin", "automation-review", "page.tsx"), "utf8");
  const data = fs.readFileSync(path.join(process.cwd(), "app", "admin", "lib", "automationReviewQueueData.ts"), "utf8");
  assert.match(page, /await requireAdminPage\(\)/);
  assert.match(page, /loadCompleteReviewQueue\(status\)/);
  assert.match(data, /REVIEW_QUEUE_MAX_ROWS/);
  assert.match(data, /REVIEW_QUEUE_READ_BATCH_SIZE/);
  assert.match(data, /Review Queue exceeds the bounded complete-read limit/);
  assert.match(data, /Review Queue changed during the complete read/);
  assert.match(data, /Review Queue complete read contained a duplicate row/);
  assert.match(data, /order\("updated_at", \{ ascending: false \}\)\.order\("id", \{ ascending: false \}\)/);
  assert.match(page, /filterAndPaginateReviewRows/);
  assert.match(page, /PENDING.*APPROVED.*REJECTED.*IGNORED.*EXPIRED.*EXECUTING.*EXECUTED.*FAILED/s);
  assert.match(page, /Freshness-only.*Stock and price.*Identity.*Source problems/s);
  assert.match(page, /AUTONOMOUS.*REVIEW_EXECUTABLE.*REVIEW_ONLY.*UNSUPPORTED/s);
  assert.match(page, /Każdy poziom pewności/);
  assert.match(page, /capabilityForReview/);
  assert.match(page, /decisionGroupForReview/);
  assert.match(page, /confidenceForReview/);
  assert.match(page, /before_state.*proposed_state.*impact_summary.*source_evidence/);
  assert.match(page, /Zaznaczone oferty/);
  assert.doesNotMatch(page, /value="approve_execute"/);
  assert.match(page, /value="approve"/);
  assert.match(page, /reviewQueuePageHref/);
  assert.match(page, /Wykonaj zatwierdzoną decyzję/);
  assert.match(page, /Approval alone has not changed the catalogue/);
  assert.match(page, /existing protected importer approval and executor RPCs/);
  assert.match(page, /Execution adapter/);
  assert.match(page, /Recommended decision/);
  assert.match(page, /Capability note/);
  assert.match(page, /Disabled reason/);
  assert.match(page, /confirmExecution/);
  assert.match(page, /disabled=\{!adapterReady\}/);
  assert.match(page, /Historia wykonania/);
  assert.match(page, /idempotency_result/);
  assert.match(page, /Oferty wymagające decyzji/);
  assert.match(page, /Jak z tego korzystać\?/);
  assert.match(page, /Co wykryto\?/);
  assert.match(page, /Co masz zrobić\?/);
  assert.match(page, /Na razie nic nie klikaj/);
  assert.match(page, /Zostaw do analizy technicznej/);
  assert.match(page, /Szczegóły techniczne — dla osoby przygotowującej zmianę/);
  assert.match(page, /rowCapability\.capability === "REVIEW_EXECUTABLE"/);
  assert.match(page, /rowCapability\.capability !== "REVIEW_EXECUTABLE"/);
  assert.match(data, /source_price,source_url,current_product_id,current_variant_id/);
  assert.match(page, /from\("products"\)\.select\("id,name,slug"\)/);
  assert.match(page, /from\("product_variants"\)\.select\("id,display_name"\)/);
  assert.match(page, /Porównaj te dwie strony przed decyzją/);
  assert.match(page, /Otwórz ofertę \{row\.retailer\}/);
  assert.match(page, /Otwórz produkt SupplementScout/);
  assert.match(page, /Cena wykryta/);
  assert.match(page, /Zapisana cena/);
  assert.match(page, /safeUrl\(row\.source_url\)/);
  assert.doesNotMatch(page, /from\("(?:products|product_variants|retailer_products|offers|price_history)"\)\.update/);
  assert.match(page, /import Image from "next\/image"/);
  assert.equal((page.match(/\/mascots\/supplement-scout-raccoon\.webp/g) || []).length, 1);
  assert.equal((page.match(/\/mascots\/supplement-scout-human-scout\.png/g) || []).length, 1);
  assert.equal(fs.existsSync(path.join(process.cwd(), "public", "mascots", "supplement-scout-raccoon.webp")), true);
  assert.equal(fs.existsSync(path.join(process.cwd(), "public", "mascots", "supplement-scout-human-scout.png")), true);
});

test("Review Queue filters the complete bounded result before pagination", () => {
  const {
    filterAndPaginateReviewRows,
    normalizeReviewQueueScope,
    reviewQueuePageHref,
  } = loadTsModule("app/admin/lib/automationReviewQueue.ts");
  const rows = Array.from({ length: 75 }, (_, index) => ({
    id: String(index + 1),
    retailer: index === 64 ? "eBay UK" : "Fit House",
    retailer_id: index === 64 ? "12" : "9",
    offer_id: String(700 + index),
    product_title: index === 64 ? "Needle Match Product" : `Ordinary Product ${index}`,
    variant_title: null,
    review_kind: "COMMERCIAL_CHANGE",
    operation_type: "UPDATE_STOCK",
    reason_codes: "STOCK_CHANGE",
    source_evidence: { confidence: "HIGH" },
    impact_summary: {},
  }));
  const filters = {
    status: "PENDING",
    retailer: "",
    kind: "",
    group: "",
    confidence: "",
    capability: "",
    query: "needle match",
    scope: normalizeReviewQueueScope(""),
  };
  const result = filterAndPaginateReviewRows(rows, filters, 1, 50);
  assert.equal(result.total, 1);
  assert.equal(result.rows[0].id, "65");
  assert.equal(result.page, 1);
  assert.equal(result.totalPages, 1);
  assert.deepEqual(result.retailers, ["eBay UK", "Fit House"]);
  assert.equal(reviewQueuePageHref({ ...filters, query: "", retailer: "eBay UK" }, 2), "?retailer=eBay+UK&page=2");
});

test("automation review capability matrix exposes only registered execution paths", () => {
  const matrixSource = fs.readFileSync(path.join(process.cwd(), "app", "lib", "automationReviewCapabilityMatrix.ts"), "utf8");
  const adapterSource = fs.readFileSync(path.join(process.cwd(), "app", "lib", "automationReviewAdapters.ts"), "utf8");
  const registry = require("../config/automation-review-execution-adapters.json");
  for (const retailer of ["Whey Okay", "Discount Supplements", "Dolphin Fitness", "GYM HIGH", "Simply Supplements", "6 Pack Supplements", "KIOR Health", "Fit House", "10 Reps", "Jon's Supplements", "eBay UK"]) assert.match(matrixSource, new RegExp(retailer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  for (const operation of ["VERIFY_NO_CHANGE", "UPDATE_PRICE", "UPDATE_STOCK", "UPDATE_PRICE_AND_STOCK", "IDENTITY_PROMOTION", "REBIND_EXISTING_VARIANT", "SOURCE_MISSING", "UNAVAILABLE_DECISION"]) assert.match(matrixSource, new RegExp(operation));
  for (const capability of ["AUTONOMOUS", "REVIEW_EXECUTABLE", "REVIEW_ONLY", "UNSUPPORTED"]) assert.match(matrixSource, new RegExp(capability));
  assert.match(matrixSource, /capabilityForReview/);
  assert.match(matrixSource, /decisionGroupForReview/);
  assert.match(matrixSource, /confidenceForReview/);
  assert.match(matrixSource, /registeredExecution/);
  assert.match(adapterSource, /automation-review-execution-adapters\.json/);
  assert.deepEqual(registry.adapters.map((adapter) => adapter.retailer_slug), ["ebay-uk", "fit-house", "10-reps", "whey-okay"]);
  assert.equal(registry.adapters.filter((adapter) => adapter.operations.includes("UPDATE_STOCK")).length, 4);
  assert.equal(registry.adapters.some((adapter) => adapter.operations.some((operation) => /REBIN|MARK_OOS/.test(operation))), false);
  const { capabilityForReview } = loadTsModule("app/lib/automationReviewCapabilityMatrix.ts");
  assert.equal(capabilityForReview("14", "UPDATE_STOCK", "COMMERCIAL_CHANGE").capability, "REVIEW_EXECUTABLE");
  assert.equal(capabilityForReview("14", "MANUAL_REVIEW_IDENTITY", "IDENTITY_CONFLICT").capability, "REVIEW_ONLY");
  assert.equal(capabilityForReview("3", "UPDATE_STOCK", "COMMERCIAL_CHANGE").capability, "REVIEW_EXECUTABLE");
  assert.equal(capabilityForReview("3", "UPDATE_PRICE", "COMMERCIAL_CHANGE").capability, "REVIEW_ONLY");
});

test("automation review decisions fail closed on auth, fingerprint, expiry and bulk incompatibility", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "app", "admin", "automation-review", "decision", "route.ts"), "utf8");
  const handler = source.slice(source.indexOf("export async function POST"));
  assert(handler.indexOf("requireAdminRoute(request)") < handler.indexOf("request.formData()"));
  assert.match(source, /selections\.length > 100/);
  assert.match(source, /source_row_fingerprint/);
  assert.match(source, /new Date\(row\.expires_at\)\.getTime\(\) <= now/);
  assert.match(source, /compatible\.size !== 1/);
  assert.match(source, /\.eq\("review_status", "PENDING"\)/);
  assert.match(source, /confirmed_unavailable !== true/);
  assert.match(source, /confirmImpact/);
  assert.doesNotMatch(source, /approve_execute/);
  assert.doesNotMatch(source, /queue_automation_review_execution/);
  assert.doesNotMatch(source, /resolveReviewAdapter/);
  assert.match(source, /decision_actor/);
  assert.match(source, /variant\.product_id/);
  assert.doesNotMatch(source, /\.from\("(?:products|product_variants|retailer_products|offers|price_history)"\)\.update/);
});

test("automation review execute action authenticates and queues work for the protected scheduled adapter", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "app", "admin", "automation-review", "execute", "route.ts"), "utf8");
  const handler = source.slice(source.indexOf("export async function POST"));
  assert(handler.indexOf("requireAdminRoute(request)") < handler.indexOf("request.formData()"));
  assert.match(source, /\["APPROVED", "FAILED"\]\.includes\(data\.review_status\)/);
  assert.match(source, /Date\.parse\(data\.expires_at\) <= Date\.now\(\)/);
  assert.match(source, /resolveReviewAdapter/);
  assert.match(source, /reviewQueueConfigured/);
  assert.match(source, /reviewWorkflowDispatchConfigured/);
  assert.match(source, /queue_automation_review_execution/);
  assert.match(source, /idempotencyKey/);
  assert.match(source, /previous\.database_writes/);
  assert.match(source, /review_status: "APPROVED"/);
  assert.match(source, /execution_mode: "review-queue"/);
  assert.match(source, /queuedStatus !== "QUEUED"/);
  assert.match(source, /dispatchReviewExecution/);
  assert.match(source, /if \(!reviewWorkflowDispatchConfigured\(\)\)/);
  assert.doesNotMatch(source, /api\.github\.com|await fetch\(/);
  assert.doesNotMatch(source, /approve_product_import_plan|apply_approved_product_import_plan/);
  assert.doesNotMatch(source, /\.from\("(?:products|product_variants|retailer_products|offers|price_history)"\)/);
});

test("automation review workflow dispatch is token-gated and exactly bound to one review request", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "app", "admin", "lib", "automationReviewWorkflowDispatch.ts"), "utf8");
  const adapterSource = fs.readFileSync(path.join(process.cwd(), "app", "lib", "automationReviewAdapters.ts"), "utf8");
  assert.match(source, /AUTOMATION_REVIEW_GITHUB_TOKEN/);
  assert.match(source, /reviewWorkflowDispatchConfigured/);
  assert.match(adapterSource, /reviewQueueConfigured/);
  assert.doesNotMatch(adapterSource, /AUTOMATION_REVIEW_GITHUB_TOKEN/);
  assert.match(source, /actions\/workflows\/.*dispatches/);
  assert.match(source, /encodeURIComponent\(options\.adapter\.workflow\)/);
  assert.match(source, /ref: "main"/);
  assert.match(source, /inputs:[\s\S]*execution_request_id: options\.executionRequestId/);
  assert.doesNotMatch(source, /review_item_id|review_fingerprint|execution_idempotency_key/);
  assert.match(source, /response\.status !== 204/);
  assert.doesNotMatch(source, /supabaseAdmin|queue_automation_review_execution|approve_product_import_plan|apply_approved_product_import_plan/);
  assert.doesNotMatch(source, /\.from\("(?:products|product_variants|retailer_products|offers|price_history)"\)/);
});

test("Automation Review Queue scheduled worker processes the oldest bounded queue batch", async () => {
  const { assertContext, run, safeErrorCode, selectCompatibleRequests } = require("./automation-review-queue-worker");
  const env = { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "schedule", GITHUB_REF: "refs/heads/main", GITHUB_REPOSITORY: "SupplementScout/supplementscout", GITHUB_SERVER_URL: "https://github.com", GITHUB_RUN_ID: "123", GITHUB_SHA: "a".repeat(40), NEXT_PUBLIC_SUPABASE_URL: "https://example.test", SUPABASE_SERVICE_ROLE_KEY: "control" };
  assert.doesNotThrow(() => assertContext(env));
  assert.throws(() => assertContext({ ...env, GITHUB_REF: "refs/heads/other" }), /QUEUE_WORKER_REPOSITORY_INVALID/);
  const request = { id: "11111111-1111-4111-8111-111111111111", review_id: 946, retailer_slug: "ebay-uk", workflow_name: "automation-review-queue-worker.yml", review_fingerprint: "b".repeat(64), plan_fingerprint: "c".repeat(64), idempotency_key: "d".repeat(64), status: "QUEUED" };
  const exactEnv = { ...env, GITHUB_EVENT_NAME: "workflow_dispatch", AUTOMATION_REVIEW_EXECUTION_REQUEST_ID: request.id };
  assert.doesNotThrow(() => assertContext(exactEnv));
  assert.throws(() => assertContext({ ...exactEnv, AUTOMATION_REVIEW_EXECUTION_REQUEST_ID: "" }), /QUEUE_WORKER_EXACT_REQUEST_ID_INVALID/);
  assert.throws(() => assertContext({ ...env, AUTOMATION_REVIEW_EXECUTION_REQUEST_ID: request.id }), /QUEUE_WORKER_SCHEDULE_SCOPE_INVALID/);
  const checkpoints = [], calls = [];
  const query = { select: () => query, eq: () => query, order: () => query, limit: async () => ({ data: [request], error: null }) };
  const db = { from: () => query, rpc: async (_name, args) => { checkpoints.push(args); return { data: { status: args.p_new_status }, error: null }; } };
  const reports = [];
  const result = await run({ env, client: db, persistReport: (report) => reports.push(report), runEbay: async (options) => { calls.push(options); return { result: "PASS", database_writes: 1 }; } });
  assert.equal(result.selection_mode, "scheduled-batch");
  assert.equal(result.processed, 1);
  assert.equal(reports.length, 1);
  assert.deepEqual(reports[0], result);
  assert.equal(checkpoints.length, 0);
  assert.equal(calls[0].reviewItemId, "946");
  assert.equal(calls[0].executionRequestId, request.id);
  const exactFilters = [];
  const exactQuery = { select: () => exactQuery, eq: (field, value) => (exactFilters.push([field, value]), exactQuery), limit: async (value) => (assert.equal(value, 1), { data: [request], error: null }) };
  const exactCalls = [];
  const exactResult = await run({ env: exactEnv, client: { from: () => exactQuery }, persistReport: () => {}, runEbay: async (options) => { exactCalls.push(options); return { result: "PASS", database_writes: 1 }; } });
  assert.equal(exactResult.selection_mode, "exact-request");
  assert.equal(exactResult.processed, 1);
  assert.deepEqual(exactFilters, [["status", "QUEUED"], ["id", request.id]]);
  assert.equal(exactCalls[0].executionRequestId, request.id);
  const missingQuery = { select: () => missingQuery, eq: () => missingQuery, limit: async () => ({ data: [], error: null }) };
  await assert.rejects(
    () => run({ env: exactEnv, client: { from: () => missingQuery }, persistReport: () => {}, runEbay: async () => ({ result: "PASS", database_writes: 1 }) }),
    /QUEUE_WORKER_EXACT_REQUEST_UNAVAILABLE/,
  );
  await assert.rejects(
    () => run({ env, client: db, persistReport: (report) => reports.push(report), runEbay: async () => { const error = new Error("unsafe upstream detail"); throw error; } }),
    (error) => error.message === "QUEUE_WORKER_BATCH_FAILED:1" && error.report.failed[0].error_code === "QUEUE_WORKER_REQUEST_FAILED",
  );
  assert.equal(reports.length, 2);
  assert.equal(reports[1].failed[0].retailer_slug, "ebay-uk");
  assert.equal(reports[1].failed[0].review_id, "946");
  assert.equal(safeErrorCode({ code: "REVIEW_EVIDENCE_EXPIRED" }), "REVIEW_EVIDENCE_EXPIRED");
  const compatibility = selectCompatibleRequests([
    { id: "fit-1", retailer_slug: "fit-house" },
    { id: "ebay-1", retailer_slug: "ebay-uk" },
    { id: "ten-1", retailer_slug: "10-reps" },
    { id: "fit-2", retailer_slug: "fit-house" },
  ]);
  assert.deepEqual(compatibility.selected.map((item) => item.id), ["fit-1", "ebay-1", "fit-2"]);
  assert.deepEqual(compatibility.deferred.map((item) => item.id), ["ten-1"]);
});

test("Automation Review Queue refresh publishes only a same-run zero-catalogue-write request", () => {
  const workflow = fs.readFileSync(path.join(process.cwd(), ".github", "workflows", "ebay-offer-refresh.yml"), "utf8");
  const source = fs.readFileSync(path.join(process.cwd(), "scripts", "automation-review-reconciliation-apply.js"), "utf8");
  const binding = fs.readFileSync(path.join(process.cwd(), "scripts", "automation-review-source-binding.js"), "utf8");
  const migration = fs.readFileSync(path.join(process.cwd(), "supabase", "migrations", "20260910193000_allow_automation_review_retry_revisions.sql"), "utf8");
  assert.match(workflow, /refresh-review-queue:[\s\S]*needs: refresh/);
  assert.match(workflow, /automation-review-source-binding\.js/);
  assert.match(workflow, /automation-review-reconciliation-apply\.js/);
  assert.match(source, /report\.expected\?\.catalogue_writes !== 0/);
  assert.match(source, /report\.source\?\.run_id.*env\.GITHUB_RUN_ID/);
  assert.match(source, /publish_automation_review_queue_changes/);
  assert.doesNotMatch(source, /\.from\("(?:products|product_variants|retailer_products|offers|price_history)"\)/);
  assert.match(binding, /contract\.report_sha256 !== reportSha256/);
  assert.match(migration, /review_status in \('PENDING', 'APPROVED', 'EXECUTING'\)/);
  assert.doesNotMatch(migration, /\b(?:insert into|update|delete from)\s+public\.(?:products|product_variants|retailer_products|offers|price_history)\b/i);
});

test("automation review adapter registry is exact, single-row and default-deny", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "app", "lib", "automationReviewAdapters.ts"), "utf8");
  const raw = require("../config/automation-review-execution-adapters.json");
  const { REVIEW_EXECUTION_ADAPTERS } = require("./lib/automation-review-adapter-registry");
  assert.equal(REVIEW_EXECUTION_ADAPTERS.length, 4);
  assert.deepEqual(REVIEW_EXECUTION_ADAPTERS.map((adapter) => adapter.retailerId), ["12", "9", "14", "3"]);
  assert.deepEqual(REVIEW_EXECUTION_ADAPTERS.find((adapter) => adapter.retailerSlug === "ebay-uk").operations, ["VERIFY_NO_CHANGE", "UPDATE_PRICE", "UPDATE_STOCK"]);
  assert.deepEqual(REVIEW_EXECUTION_ADAPTERS.find((adapter) => adapter.retailerSlug === "10-reps").operations, ["UPDATE_STOCK"]);
  assert.deepEqual(REVIEW_EXECUTION_ADAPTERS.find((adapter) => adapter.retailerSlug === "whey-okay").operations, ["UPDATE_STOCK"]);
  assert.equal(raw.adapters.find((adapter) => adapter.retailer_slug === "10-reps").shared_engine.freshness_confirmation_count, 19);
  for (const adapter of REVIEW_EXECUTION_ADAPTERS.filter((candidate) => candidate.workerKind === "shared-retailer")) {
    assert.match(adapter.sharedEngine.engineModule, /^scripts\/[a-z0-9-]+\.js$/);
  }
  assert.match(source, /automation-review-execution-adapters\.json/);
  assert.match(source, /maximumBatch: 1/);
  assert.match(source, /isolation: "per-row"/);
  assert.match(source, /reviewBinding: "immutable-review-record"/);
  assert.match(source, /kind: "control-plane-request"/);
  for (const input of ["execution_request_id", "review_item_id", "review_fingerprint", "review_plan_fingerprint", "execution_idempotency_key"]) assert.match(source, new RegExp(input));
  assert.match(source, /EXECUTION_UNSUPPORTED/);
  assert.doesNotMatch(source, /REBIN|MARK_OOS/);
  const { resolveReviewAdapter } = loadTsModule("app/lib/automationReviewAdapters.ts");
  assert.equal(resolveReviewAdapter("14", "UPDATE_STOCK", "STOCK_CHANGE").adapter?.retailerSlug, "10-reps");
  assert.equal(resolveReviewAdapter("14", "MANUAL_REVIEW_IDENTITY", "SOURCE_MISSING").adapter, null);
});

test("automation review UI exposes executable versus review drift scope", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "app", "admin", "automation-review", "page.tsx"), "utf8");
  const data = fs.readFileSync(path.join(process.cwd(), "app", "admin", "lib", "automationReviewQueueData.ts"), "utf8");
  assert.match(source, /source_evidence\?\.drift_scope/);
  assert.match(source, /Drift scope: \{driftScope\}/);
  assert.match(data, /request\.gt\("expires_at"/);
  assert.match(source, /current === "FAILED".*execution\?\.database_writes/s);
});

test("execution request migration is additive, immutable, role-closed and contains no catalogue DML", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "supabase", "migrations", "20260830173000_create_automation_review_execution_requests.sql"), "utf8");
  assert.match(source, /^begin;/i); assert.match(source, /commit;\s*$/i);
  assert.match(source, /create table public\.automation_review_execution_requests/);
  assert.match(source, /create table public\.automation_review_execution_events/);
  assert.match(source, /where status in \('QUEUED','DISPATCHED','EXECUTING'\)/);
  assert.match(source, /AUTOMATION_EXECUTION_REQUEST_IDENTITY_IMMUTABLE/);
  assert.match(source, /queue_automation_review_execution/);
  assert.match(source, /record_automation_review_execution_checkpoint/);
  assert.match(source, /coalesce\(auth\.role\(\),''\) <> 'service_role'/);
  assert.doesNotMatch(source, /current_user <> 'service_role'/);
  assert.match(source, /grant execute on function public\.queue_automation_review_execution[^;]+ to service_role/s);
  assert.doesNotMatch(source, /\b(drop|truncate)\b/i);
  assert.doesNotMatch(source, /\b(?:insert into|update|delete from)\s+public\.(?:products|product_variants|retailer_products|offers|price_history)\b/i);
});

test("Review Queue eBay worker is workflow-bound, revalidates evidence and forbids replay or offer 2686", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "scripts", "automation-review-ebay-worker.js"), "utf8");
  const control = fs.readFileSync(path.join(process.cwd(), "scripts", "lib", "automation-review-worker-control.js"), "utf8");
  const { parseArgs, assertContext } = require("./automation-review-ebay-worker");
  const args = ["--review-item-id=7", "--execution-request-id=11111111-1111-4111-8111-111111111111", "--retailer=ebay-uk", `--review-fingerprint=${"a".repeat(64)}`, `--review-plan-fingerprint=${"b".repeat(64)}`, `--execution-idempotency-key=${"c".repeat(64)}`, "--mode=review-queue"];
  assert.deepEqual(parseArgs(args), { reviewItemId: "7", executionRequestId: "11111111-1111-4111-8111-111111111111", retailer: "ebay-uk", reviewFingerprint: "a".repeat(64), reviewPlanFingerprint: "b".repeat(64), executionIdempotencyKey: "c".repeat(64), mode: "review-queue" });
  assert.throws(() => parseArgs(args.map((value) => value.startsWith("--execution-request-id=") ? "--execution-request-id=bad" : value)), /EXECUTION_REQUEST_ID_INVALID/);
  assert.throws(() => assertContext({}), /WORKER_CONTEXT_INVALID/);
  assert.doesNotThrow(() => assertContext({ GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "schedule", GITHUB_REF: "refs/heads/main", GITHUB_REPOSITORY: "SupplementScout/supplementscout", SUPABASE_SERVICE_ROLE_KEY: "x", NEXT_PUBLIC_SUPABASE_URL: "https://example.test", EBAY_CANARY_APPROVER_DATABASE_URL: "x", EBAY_CANARY_EXECUTOR_DATABASE_URL: "x", EBAY_REFRESH_VALIDATOR_DATABASE_URL: "x" }));
  assert.match(source, /claimDispatched/);
  assert.match(control, /request\.status === "QUEUED"/);
  assert.match(control, /WORKFLOW_DISPATCH_CLAIMED/);
  assert.match(control, /review\.review_status === "APPROVED"/);
  assert.match(control, /event\.source_row_fingerprint === review\.source_row_fingerprint/);
  assert.match(control, /event\.plan_fingerprint === review\.plan_fingerprint/);
  assert.match(source, /SOURCE_FINGERPRINT_DRIFT/);
  assert.match(source, /APPROVED_PRICE_DRIFT/);
  assert.match(source, /PLAN_FINGERPRINT_DRIFT/);
  assert.match(source, /DATABASE_BEFORE_STATE_DRIFT/);
  assert.match(source, /OFFER_2686_FORBIDDEN/);
  assert.match(source, /APPLY_RESULT_SCOPE_DRIFT/);
  assert.match(source, /actionForPlan\(fresh\.approved\.entry\.resolved_plan\) === "VERIFY_NO_CHANGE"/);
  assert.match(source, /price_history_delta/);
  assert.doesNotMatch(source, /\b(?:insert into|update|delete from)\s+(?:public\.)?(?:products|product_variants|retailer_products|offers|price_history)\b/i);
});

test("Review Queue eBay worker claims a queued direct dispatch only after the workflow starts", async () => {
  const { claimDispatched } = require("./automation-review-ebay-worker");
  const previous = {
    GITHUB_RUN_ID: process.env.GITHUB_RUN_ID,
    GITHUB_SERVER_URL: process.env.GITHUB_SERVER_URL,
    GITHUB_REPOSITORY: process.env.GITHUB_REPOSITORY,
    GITHUB_SHA: process.env.GITHUB_SHA,
    GITHUB_ACTOR: process.env.GITHUB_ACTOR,
  };
  process.env.GITHUB_RUN_ID = "12345";
  process.env.GITHUB_SERVER_URL = "https://github.com";
  process.env.GITHUB_REPOSITORY = "SupplementScout/supplementscout";
  process.env.GITHUB_SHA = "a".repeat(40);
  process.env.GITHUB_ACTOR = "review-worker";
  try {
    const calls = [];
    const db = { rpc: async (name, args) => { calls.push({ name, args }); return { data: { status: args.p_new_status }, error: null }; } };
    const request = { id: "11111111-1111-4111-8111-111111111111", status: "QUEUED" };
    const claimed = await claimDispatched(db, request, { executionRequestId: request.id });
    assert.equal(claimed.status, "DISPATCHED");
    assert.equal(calls[0].name, "record_automation_review_execution_checkpoint");
    assert.equal(calls[0].args.p_new_status, "DISPATCHED");
    assert.equal(calls[0].args.p_checkpoint, "WORKFLOW_DISPATCH_CLAIMED");
    assert.equal(calls[0].args.p_evidence.run_id, "12345");
    assert.equal(calls[0].args.p_evidence.database_writes, 0);
    const alreadyDispatched = await claimDispatched(db, { ...request, status: "DISPATCHED" }, { executionRequestId: request.id });
    assert.equal(alreadyDispatched.status, "DISPATCHED");
    assert.equal(calls.length, 1);
    await assert.rejects(() => claimDispatched(db, { ...request, status: "EXECUTING" }, { executionRequestId: request.id }), /EXECUTION_REQUEST_BINDING_DRIFT/);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("Review Queue worker trusts the immutable admin approval event after publisher metadata drift", async () => {
  const { loadControlState } = require("./lib/automation-review-worker-control");
  const fingerprint = "a".repeat(64), planFingerprint = "b".repeat(64);
  const review = {
    id: "77", retailer_id: "9", review_status: "APPROVED", operation_type: "UPDATE_STOCK",
    source_row_fingerprint: fingerprint, plan_fingerprint: planFingerprint,
    source_captured_at: "2026-10-05T16:00:00.000Z", expires_at: "2099-10-05T16:00:00.000Z",
    decision_actor: "automation-review-publisher", decision_at: "2026-10-05T16:30:00.000Z",
    before_state: { in_stock: false }, proposed_state: { in_stock: true },
  };
  const request = {
    id: "11111111-1111-4111-8111-111111111111", review_id: "77", status: "DISPATCHED",
    retailer_id: "9", retailer_slug: "fit-house", workflow_name: "automation-review-queue-worker.yml",
    environment_name: "production-readonly", execution_mode: "review-queue", operation_type: "UPDATE_STOCK",
    review_fingerprint: fingerprint, plan_fingerprint: planFingerprint, idempotency_key: "c".repeat(64),
  };
  const approval = {
    previous_status: "PENDING", new_status: "APPROVED", actor: "authenticated-admin",
    source_row_fingerprint: fingerprint, plan_fingerprint: planFingerprint,
    created_at: "2026-10-05T16:30:00.000Z",
  };
  const client = (events) => ({
    from(table) {
      const value = table === "product_match_review_queue" ? review : table === "automation_review_execution_requests" ? request : events;
      const query = {
        select: () => query,
        eq: () => query,
        order: async () => ({ data: value, error: null }),
        maybeSingle: async () => ({ data: value, error: null }),
      };
      return query;
    },
  });
  const options = { reviewItemId: "77", executionRequestId: request.id, retailer: "fit-house", reviewFingerprint: fingerprint, reviewPlanFingerprint: planFingerprint, executionIdempotencyKey: request.idempotency_key, mode: "review-queue" };
  const contract = { retailerId: "9", retailerSlug: "fit-house", operations: new Set(["UPDATE_STOCK"]), workflowName: request.workflow_name, environment: request.environment_name };

  const state = await loadControlState(client([approval]), options, contract);
  assert.equal(state.review.id, "77");
  await assert.rejects(() => loadControlState(client([{ ...approval, actor: "automation-review-publisher" }]), options, contract), /APPROVAL_AUDIT_MISSING/);
});

test("Review Queue eBay worker derives exact single-row commercial postflight deltas", () => {
  const { assertDatabaseBeforeState, expectedDeltas } = require("./automation-review-ebay-worker");
  const price = expectedDeltas({ expected_state: { offer: { price: "10.00", shipping_cost: "3.99", total_price: "13.99", in_stock: true, url: "https://example.test" } }, offer: { values: { price: "10.58", shipping_cost: "3.99", total_price: "14.57", in_stock: true, url: "https://example.test" } } });
  assert.deepEqual(price.logical_field_deltas, { offer_price_updates: 1, offer_stock_updates: 0, offer_shipping_updates: 0, offer_total_updates: 1, offer_url_updates: 0, mapping_url_updates: 0, last_checked_at_updates: 1 });
  assert.equal(price.row_count_deltas.price_history, 1);
  const stock = expectedDeltas({ expected_state: { offer: { price: "22.49", shipping_cost: "0", total_price: "22.49", in_stock: false, url: "https://example.test" } }, offer: { values: { price: "22.49", shipping_cost: "0", total_price: "22.49", in_stock: true, url: "https://example.test" } } });
  assert.equal(stock.logical_field_deltas.offer_stock_updates, 1);
  assert.equal(stock.row_count_deltas.price_history, 0);
  assert.doesNotThrow(() => assertDatabaseBeforeState(
    { price: "22.4900", shipping_cost: "0.00", total_price: "22.49", in_stock: false, url: "https://example.test", last_checked_at: "2026-09-10T17:00:00.123000Z" },
    { price: "22.49", shipping_cost: "0", total_price: "22.490", in_stock: false, url: "https://example.test", last_checked_at: "2026-09-10T18:00:00.123+01:00" },
  ));
  assert.throws(() => assertDatabaseBeforeState(
    { price: "22.48", shipping_cost: "0", total_price: "22.48", in_stock: false, url: "https://example.test", last_checked_at: "2026-09-10T17:00:00Z" },
    { price: "22.49", shipping_cost: "0", total_price: "22.49", in_stock: false, url: "https://example.test", last_checked_at: "2026-09-10T17:00:00Z" },
  ), /DATABASE_BEFORE_STATE_DRIFT_PRICE/);
});

test("Review Queue eBay worker removes the control credential only during role-separated apply", async () => {
  const { executeWithSeparatedCredentials } = require("./automation-review-ebay-worker");
  const env = { SUPABASE_SERVICE_ROLE_KEY: "control-secret" };
  const result = await executeWithSeparatedCredentials(async () => {
    assert.equal(env.SUPABASE_SERVICE_ROLE_KEY, undefined);
    return { offer_id: "2639" };
  }, {}, "test", env);
  assert.equal(result.offer_id, "2639");
  assert.equal(env.SUPABASE_SERVICE_ROLE_KEY, "control-secret");
  await assert.rejects(() => executeWithSeparatedCredentials(async () => { throw new Error("apply failed"); }, {}, "test", env), /apply failed/);
  assert.equal(env.SUPABASE_SERVICE_ROLE_KEY, "control-secret");
});

test("owner decision audit is bounded, SELECT-only, and starts from immutable admin events", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "scripts", "automation-review-owner-decision-audit.js"), "utf8");
  const { auditData, auditExitCode, monitorStatus, parseArgs } = require("./automation-review-owner-decision-audit");
  assert.throws(() => parseArgs(["--mode=apply"]), /AUDIT_MODE_NOT_ALLOWED/);
  assert.match(source, /actor", OWNER/);
  assert.match(source, /previous_status", "PENDING"/);
  assert.match(source, /PAGE_SIZE = 500/);
  assert.doesNotMatch(source, /\.rpc\(|\.insert\(|\.update\(|\.delete\(/);
  const review = { id: 1, retailer_id: 9, offer_id: 44, operation_type: "UPDATE_STOCK", review_status: "EXECUTED", source_row_fingerprint: "a".repeat(64), plan_fingerprint: "b".repeat(64) };
  const decision = { id: 1, review_id: 1, actor: "authenticated-admin", previous_status: "PENDING", new_status: "APPROVED", source_row_fingerprint: review.source_row_fingerprint, plan_fingerprint: review.plan_fingerprint, created_at: "2026-10-05T10:00:00Z" };
  const request = { id: "11111111-1111-4111-8111-111111111111", review_id: 1, retailer_id: 9, operation_type: "UPDATE_STOCK", review_fingerprint: review.source_row_fingerprint, plan_fingerprint: review.plan_fingerprint, status: "EXECUTED", completed_at: "2026-10-05T10:02:00Z", postflight_hash: "c".repeat(64), idempotency_result: "PASS", failed_offer_ids: [], remaining_offer_ids: [], executed_offer_ids: ["44"], expected_deltas: {}, actual_deltas: {}, database_writes: 20, requested_at: "2026-10-05T10:01:00Z" };
  const executionEvent = { id: 1, execution_request_id: request.id, new_status: "EXECUTED", created_at: "2026-10-05T10:02:00Z" };
  const result = auditData({ decisionEvents: [decision], reviews: [review], requests: [request], executionEvents: [executionEvent] }, new Date("2026-10-05T10:03:00Z"));
  assert.equal(result.anomalies.length, 0);
  assert.equal(result.summaries[0].outcome, "EXECUTED");
  assert.equal(result.summaries[0].github_artifact_verification_required, true);
  assert.deepEqual(monitorStatus({ reviews: [], requests: [], anomalies: [] }), { monitor_status: "SUCCESS", pending_owner_decision_count: 0, active_execution_count: 0, review_attention_count: 0, system_failure_count: 0 });
  const waiting = monitorStatus({ reviews: [{ review_status: "PENDING" }], requests: [], anomalies: [{ code: "OWNER_DECISION_EVIDENCE_DRIFT" }] });
  assert.equal(waiting.monitor_status, "WAITING_FOR_DECISION");
  assert.equal(waiting.pending_owner_decision_count, 1);
  assert.equal(waiting.review_attention_count, 1);
  assert.equal(auditExitCode(waiting), 0);
  const delayedRequest = { ...request, status: "QUEUED", completed_at: null, requested_at: "2026-10-05T09:40:00Z" };
  const delayed = auditData({ decisionEvents: [decision], reviews: [{ ...review, review_status: "APPROVED" }], requests: [delayedRequest], executionEvents: [] }, new Date("2026-10-05T10:03:00Z"));
  assert.deepEqual(delayed.anomalies.filter((row) => row.execution_request_id === request.id), [{ code: "EXECUTION_QUEUE_DELAYED", review_id: "1", execution_request_id: request.id, status: "QUEUED", threshold_minutes: 10 }]);
  const delayedStatus = monitorStatus({ reviews: [{ review_status: "APPROVED" }], requests: [delayedRequest], anomalies: delayed.anomalies });
  assert.equal(delayedStatus.monitor_status, "WAITING_FOR_DECISION");
  assert.equal(delayedStatus.system_failure_count, 0);
  assert.equal(auditExitCode(delayedStatus), 0);
  const failed = monitorStatus({ reviews: [], requests: [{ status: "EXECUTING" }], anomalies: [{ code: "EXECUTION_STUCK" }] });
  assert.equal(failed.monitor_status, "FAILED_SYSTEM");
  assert.equal(failed.active_execution_count, 1);
  assert.equal(failed.system_failure_count, 1);
  assert.equal(auditExitCode(failed), 1);
  const workflow = fs.readFileSync(path.join(process.cwd(), ".github", "workflows", "automation-review-queue-worker.yml"), "utf8");
  assert.match(workflow, /Remove test-only execution evidence/);
  assert.match(workflow, /automation-review-owner-decision-audit\.js/);
  assert.doesNotMatch(workflow, /continue-on-error: true/);
  assert.match(workflow, /steps\.owner_audit\.outcome == 'success'/);
  assert.match(workflow, /execution_request_id:[\s\S]*required: true/);
  assert.match(workflow, /AUTOMATION_REVIEW_EXECUTION_REQUEST_ID:.*github\.event\.inputs\.execution_request_id/);
  assert.match(workflow, /Monitor status:/);
});

test("shared retailer Review Queue worker uses one registry for Fit House, 10 Reps and Whey Okay", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "scripts", "automation-review-shared-retailer-worker.js"), "utf8");
  const workflow = fs.readFileSync(path.join(process.cwd(), ".github", "workflows", "automation-review-queue-worker.yml"), "utf8");
  const capability = fs.readFileSync(path.join(process.cwd(), "app", "lib", "automationReviewCapabilityMatrix.ts"), "utf8");
  const { ADAPTERS, assertContext, parseArgs } = require("./automation-review-shared-retailer-worker");
  assert.deepEqual(Object.keys(ADAPTERS), ["fit-house", "10-reps", "whey-okay"]);
  for (const adapter of Object.values(ADAPTERS)) {
    assert.equal(adapter.expectedExecutionRows, 20);
    assert.equal(adapter.expectedCommercialChanges, 1);
    assert.equal(adapter.freshnessConfirmationCount, 19);
    assert.deepEqual([...adapter.operations], ["UPDATE_STOCK"]);
  }
  assert.match(source, /engine\.buildReviewQueueRun/);
  assert.match(source, /engine\.buildIdempotencyRun/);
  assert.match(source, /engine\.validate/);
  assert.match(source, /engine\.registrationRequest/);
  assert.match(source, /engine\.approveAndExecute/);
  assert.match(source, /IDEMPOTENCY_FAILED/);
  assert.doesNotMatch(source, /\b(?:insert into|update|delete from)\s+(?:public\.)?(?:products|product_variants|retailer_products|offers|price_history)\b/i);
  assert.match(workflow, /group: retailer-offer-production-write/);
  for (const prefix of ["FIT_HOUSE_SYNC", "TEN_REPS_REFRESH", "WHEY_OKAY_SYNC"]) for (const role of ["VALIDATOR", "APPROVER", "EXECUTOR"]) assert.match(workflow, new RegExp(`${prefix}_${role}_DATABASE_URL`));
  assert.match(workflow, /WHEY_OKAY_REFRESH_VALIDATOR_DATABASE_URL/);
  assert.match(workflow, /TEN_REPS_FEED_URL/);
  assert.match(capability, /retailerId: "9"[\s\S]*UPDATE_STOCK: registeredExecution\("9"/);
  assert.match(capability, /retailerId: "14"[\s\S]*UPDATE_STOCK: registeredExecution\("14"/);
  assert.match(capability, /retailerId: "3"[\s\S]*UPDATE_STOCK: registeredExecution\("3"/);
  const args = ["--review-item-id=7", "--execution-request-id=11111111-1111-4111-8111-111111111111", "--retailer=10-reps", `--review-fingerprint=${"a".repeat(64)}`, `--review-plan-fingerprint=${"b".repeat(64)}`, `--execution-idempotency-key=${"c".repeat(64)}`, "--mode=review-queue"];
  assert.equal(parseArgs(args).retailer, "10-reps");
  const context = { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "schedule", GITHUB_REF: "refs/heads/main", GITHUB_REPOSITORY: "SupplementScout/supplementscout", SUPABASE_SERVICE_ROLE_KEY: "control", NEXT_PUBLIC_SUPABASE_URL: "https://example.test", TEN_REPS_REFRESH_VALIDATOR_DATABASE_URL: "validator", TEN_REPS_REFRESH_APPROVER_DATABASE_URL: "approver", TEN_REPS_REFRESH_EXECUTOR_DATABASE_URL: "executor" };
  assert.doesNotThrow(() => assertContext(ADAPTERS["10-reps"], context));
  assert.throws(() => assertContext(ADAPTERS["10-reps"], { ...context, TEN_REPS_REFRESH_EXECUTOR_DATABASE_URL: "" }), /WORKER_ROLE_CREDENTIAL_MISSING/);
});

test("shared retailer Review Queue engines expose the common guarded execution contract", () => {
  for (const modulePath of ["./fit-house-offer-refresh", "./whey-okay-offer-refresh"]) {
    const engine = require(modulePath);
    for (const method of ["readState", "buildReviewQueueRun", "buildIdempotencyRun", "validate", "registrationRequest", "register", "approveAndExecute"]) {
      assert.equal(typeof engine[method], "function", `${modulePath} must expose ${method}`);
    }
  }
});

test("shared retailer Review Queue selection isolates one stock decision with exact freshness confirmations", () => {
  const { selectReviewQueueExecutionRows } = require("./lib/automation-review-execution-selection");
  const confirmations = Array.from({ length: 19 }, (_, index) => ({ offer_id: String(index + 1), action: "VERIFY_NO_CHANGE", changed_fields: { stock: false, price: false, url: false, blocked: false }, target: { in_stock: true }, source: { in_stock: true } }));
  const selected = { offer_id: "900", action: "UPDATE_STOCK", changed_fields: { stock: true, price: false, url: false, blocked: false }, target: { in_stock: true }, source: { in_stock: false } };
  const selection = { offerId: "900", operation: "UPDATE_STOCK", maximumCommercialChanges: 1, freshnessConfirmationCount: 19 };
  assert.deepEqual(selectReviewQueueExecutionRows({ rows: [selected, ...confirmations] }, selection).map((row) => row.offer_id), ["900", ...confirmations.map((row) => row.offer_id)]);
  assert.throws(() => selectReviewQueueExecutionRows({ rows: [{ ...selected, action: "UPDATE_PRICE" }, ...confirmations] }, selection), /REVIEW_EXECUTION_SOURCE_OPERATION_DRIFT/);
  assert.throws(() => selectReviewQueueExecutionRows({ rows: [selected, ...confirmations.slice(0, 18)] }, selection), /REVIEW_EXECUTION_CONFIRMATION_SCOPE_DRIFT/);
  assert.throws(() => selectReviewQueueExecutionRows({ rows: [{ ...selected, changed_fields: { stock: true, price: true, url: false, blocked: false } }, ...confirmations] }, selection), /REVIEW_EXECUTION_NOT_ISOLATED_STOCK_CHANGE/);
});

test("shared retailer Review Queue worker behavior binds and proves Fit House, 10 Reps and Whey Okay stock decisions", async () => {
  const { run } = require("./automation-review-shared-retailer-worker");
  const retailerIds = { "fit-house": "9", "10-reps": "14", "whey-okay": "3" };
  const scenarios = [
    { retailer: "fit-house", url: "https://fithouse.uk/p", rolePrefix: "FIT_HOUSE_SYNC", executionRequestId: "11111111-1111-4111-8111-111111111111" },
    { retailer: "10-reps", url: "https://www.10reps.co.uk/p", rolePrefix: "TEN_REPS_REFRESH", executionRequestId: "22222222-2222-4222-8222-222222222222" },
    { retailer: "whey-okay", url: "https://wheyokay.com/p", rolePrefix: "WHEY_OKAY_SYNC", executionRequestId: "33333333-3333-4333-8333-333333333333" },
  ];
  for (const scenario of scenarios) {
    const beforeState = { offer_id: "900", retailer_product_id: "800", product_id: "700", product_variant_id: "600", price: "10.00", shipping_cost: "3.99", total_price: "13.99", in_stock: true, url: scenario.url, external_url: scenario.url, external_product_id: "500", external_variant_id: "400" };
    const review = { id: 77, retailer_id: retailerIds[scenario.retailer], review_status: "APPROVED", decision_actor: "authenticated-admin", decision_at: "2030-01-01T00:00:00.000Z", expires_at: "2030-01-01T01:00:00.000Z", offer_id: "900", retailer_product_id: "800", operation_type: "UPDATE_STOCK", before_state: beforeState, proposed_state: { ...beforeState, in_stock: false }, source_row_fingerprint: "a".repeat(64), plan_fingerprint: "b".repeat(64) };
    const record = { product: { id: "700" }, variant: { id: "600" }, mapping: { id: "800", external_product_id: "500", external_variant_id: "400", external_url: scenario.url }, offer: { id: "900", price: "10", shipping_cost: "3.990", total_price: "13.99", in_stock: true, url: scenario.url } };
    const confirmations = Array.from({ length: 19 }, (_, index) => ({ offer_id: String(index + 1), action: "VERIFY_NO_CHANGE", changed_fields: { stock: false, price: false, url: false }, atomic_plan: { expected_state: { offer: { price: "10.00", in_stock: true } }, offer: { action: "verify_no_change", values: { price: "10.00", in_stock: true } } } }));
    const changed = { offer_id: "900", retailer_product_id: "800", external_product_id: "500", external_variant_id: "400", action: "UPDATE_STOCK", changed_fields: { stock: true, price: false, url: false, blocked: false }, atomic_plan: { expected_state: { offer: { price: "10.00", in_stock: true } }, offer: { action: "update", values: { price: "10.00", in_stock: false } } } };
    const deltas = { row_count_deltas: { products: 0, product_variants: 0, retailer_products: 0, offers: 0, price_history: 0 }, logical_field_deltas: { offer_price_updates: 0, offer_shipping_updates: 0, offer_total_updates: 0, offer_stock_updates: 1, offer_url_updates: 0, mapping_url_updates: 0, mapping_updated_at_updates: 0, last_checked_at_updates: 20 } };
    const runPlan = { artifacts: [{ rows: [changed, ...confirmations], expected_deltas: deltas }] };
    let reads = 0;
    const engine = {
      readState: async () => (++reads === 1 ? { records: [record, ...confirmations.map((row) => ({ offer: { id: row.offer_id } }))] } : { records: [] }),
      buildReviewQueueRun: async (_target, _state, selection) => selection ? runPlan : null,
      buildIdempotencyRun: async () => ({ classification: { rows: [{ offer_id: "900", action: "VERIFY_NO_CHANGE" }] } }),
      validate: async () => [{ result: { valid: true } }],
      registrationRequest: () => ({ children: [{ artifact: runPlan.artifacts[0] }] }),
      register: async () => ({ result: { status: "REGISTERED" } }),
      approveAndExecute: async () => [{ result: { status: "APPLIED" } }],
    };
    if (scenario.retailer !== "whey-okay") engine.prepareSequentialParentApproval = async () => ({ status: "APPROVED" });
    const checkpoints = [];
    const client = { rpc: async (_name, args) => { checkpoints.push(args); return { data: { status: args.p_new_status }, error: null }; } };
    const baseline = { evidence_hash: "c".repeat(64), snapshot: { rows: [{ offer_id: "900", mapping_id: "800", offer_product_id: "700", offer_variant_id: "600", external_product_id: "500", external_variant_id: "400", price: "10.0", shipping_cost: "3.99", total_price: "13.990", in_stock: true, url: scenario.url, external_url: scenario.url }] } };
    const env = { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "schedule", GITHUB_REF: "refs/heads/main", GITHUB_REPOSITORY: "SupplementScout/supplementscout", GITHUB_SERVER_URL: "https://github.com", GITHUB_RUN_ID: "123", GITHUB_SHA: "d".repeat(40), NEXT_PUBLIC_SUPABASE_URL: "https://example.test", SUPABASE_SERVICE_ROLE_KEY: "control", WHEY_OKAY_REFRESH_VALIDATOR_DATABASE_URL: "validator", [`${scenario.rolePrefix}_VALIDATOR_DATABASE_URL`]: "validator", [`${scenario.rolePrefix}_APPROVER_DATABASE_URL`]: "approver", [`${scenario.rolePrefix}_EXECUTOR_DATABASE_URL`]: "executor" };
    const request = { id: scenario.executionRequestId, review_id: 77, retailer_id: review.retailer_id, retailer_slug: scenario.retailer, operation_type: "UPDATE_STOCK", review_fingerprint: review.source_row_fingerprint, plan_fingerprint: review.plan_fingerprint, idempotency_key: "e".repeat(64), requested_by: "authenticated-admin", requested_at: "2030-01-01T00:01:00.000Z", status: "DISPATCHED" };
    const report = await run({ reviewItemId: "77", executionRequestId: scenario.executionRequestId, retailer: scenario.retailer, reviewFingerprint: review.source_row_fingerprint, reviewPlanFingerprint: review.plan_fingerprint, executionIdempotencyKey: "e".repeat(64), mode: "review-queue" }, { env, client, engine, loadControlState: async () => ({ review, request }), runPostflight: async (options) => options.mode === "baseline" ? baseline : { postflight_hash: "f".repeat(64), freshness_change_count: 20, price_change_count: 0, stock_change_count: 1, shipping_change_count: 0, total_change_count: 0, offer_url_change_count: 0, mapping_url_change_count: 0, price_history_delta: 0 } });
    assert.equal(report.result, "PASS");
    assert.equal(report.database_writes, 20);
    assert.deepEqual(report.executed_offer_ids, ["900"]);
    assert.equal(report.freshness_confirmation_offer_ids.length, 19);
    assert.deepEqual(checkpoints.map((row) => row.p_new_status), ["EXECUTING", "EXECUTED"]);
    assert.equal(env.SUPABASE_SERVICE_ROLE_KEY, "control");
    assert.equal(env.RETAILER_REFRESH_PROFILE, scenario.retailer === "10-reps" ? "10reps" : scenario.retailer);
  }
});

test("Review Queue stale-state hashing canonicalizes equivalent timestamps without losing microseconds", () => {
  const { hash } = require("./automation-review-ebay-worker");
  assert.equal(
    hash({ offer: { last_checked_at: "2026-08-30T14:11:22.619000Z" }, source_captured_at: "2026-08-30T14:11:23Z" }),
    hash({ offer: { last_checked_at: "2026-08-30T14:11:22.619Z" }, source_captured_at: "2026-08-30T15:11:23+01:00" }),
  );
  assert.notEqual(hash({ last_checked_at: "2026-08-30T14:11:22.619001Z" }), hash({ last_checked_at: "2026-08-30T14:11:22.619000Z" }));
});

test("eBay Review Queue execution accepts database UTC-offset source capture timestamps", () => {
  const { normalizeApprovedSourceCapturedAt } = require("./ebay-offer-refresh");
  const now = new Date("2026-10-05T00:00:00.000Z");
  assert.equal(normalizeApprovedSourceCapturedAt("2026-10-04T11:27:18.176+00:00", "2687", now), "2026-10-04T11:27:18.176Z");
  assert.equal(normalizeApprovedSourceCapturedAt("2026-10-04T12:27:18+01:00", "2687", now), "2026-10-04T11:27:18.000Z");
  assert.throws(() => normalizeApprovedSourceCapturedAt("2026-10-06T00:00:00.000Z", "2687", now), /Approved source capture timestamp is invalid for offer 2687/);
  assert.throws(() => normalizeApprovedSourceCapturedAt("2026-10-04T11:27:18.176123+00:00", "2687", now), /Approved source capture timestamp is invalid for offer 2687/);
});

test("eBay workflow leaves Review Queue execution to the single shared queue worker", () => {
  const workflow = fs.readFileSync(path.join(process.cwd(), ".github", "workflows", "ebay-offer-refresh.yml"), "utf8");
  assert.match(workflow, /execution_mode:[\s\S]*options: \[catalogue-refresh, review-queue-reconciliation\]/);
  assert.doesNotMatch(workflow, /review-execution:|automation-review-ebay-worker\.js|execution_request_id:|execution_idempotency_key:/);
});

test("review execution coordinator delegates protected execution and blocks drift or replay", async () => {
  const { coordinateReviewExecution, transitionAllowed, capabilityFor, hash } = require("./lib/automation-review-execution-coordinator");
  const now = new Date("2026-08-30T15:00:00.000Z");
  const before = { offer: { price: "10.00", shipping_cost: "0.00", total_price: "10.00", in_stock: true, url: "https://example.test/p", last_checked_at: "2026-08-29T00:00:00.000Z" } };
  const after = { offer: { ...before.offer, last_checked_at: "2026-08-30T14:59:00.000Z" } };
  const item = { id: "1", retailer_id: "12", offer_id: "2539", review_status: "APPROVED", decision_actor: "owner", operation_type: "VERIFY_NO_CHANGE", expires_at: "2026-08-31T00:00:00.000Z", source_row_fingerprint: "a".repeat(64), before_state: before, proposed_state: after };
  const calls = [];
  const plan = { operation_type: "VERIFY_NO_CHANGE", before_state: before, after_state: after, expected_deltas: { price_history: 0 }, fingerprint: "b".repeat(64) };
  const adapter = {
    authorize: async () => true,
    capture: async () => ({ fingerprint: item.source_row_fingerprint, captured_at: "2026-08-30T14:59:00.000Z" }),
    loadDatabaseState: async () => before,
    buildProtectedPlan: async () => plan,
    approveProtectedPlan: async () => (calls.push("approve"), { approval_id: "approval-1" }),
    applyProtectedPlan: async () => (calls.push("apply"), { executed: true }),
    postflight: async () => (calls.push("postflight"), { result: "PASS" }),
    idempotency: async () => (calls.push("idempotency"), { result: "PASS" }),
  };
  const dryRun = await coordinateReviewExecution({ reviewItem: item, actor: "owner", adapter, now });
  assert.equal(dryRun.result, "READY"); assert.equal(dryRun.database_writes, 0); assert.deepEqual(calls, []);
  const result = await coordinateReviewExecution({ reviewItem: item, actor: "owner", adapter, now, mode: "apply", checkpoint: async (status) => (calls.push(status), "execution-1") });
  assert.equal(result.result, "PASS");
  assert.deepEqual(calls, ["EXECUTING", "approve", "apply", "postflight", "idempotency", "EXECUTED"]);
  const failedCalls = [];
  await assert.rejects(() => coordinateReviewExecution({ reviewItem: item, actor: "owner", adapter: { ...adapter, postflight: async () => ({ result: "BLOCK" }) }, now, mode: "apply", checkpoint: async (status) => (failedCalls.push(status), "execution-2") }), /DB_POSTFLIGHT_FAILED/);
  assert.deepEqual(failedCalls, ["EXECUTING", "FAILED"]);
  const deferred = await coordinateReviewExecution({ reviewItem: item, actor: "owner", adapter: { ...adapter, idempotency: async () => { const error = new Error("timeout"); error.code = "SOURCE_TIMEOUT"; throw error; } }, now, mode: "apply", checkpoint: async () => "execution-3" });
  assert.equal(deferred.result, "PASS_IDEMPOTENCY_DEFERRED");
  await assert.rejects(() => coordinateReviewExecution({ reviewItem: { ...item, source_row_fingerprint: "c".repeat(64) }, actor: "owner", adapter, now }), /SOURCE_FINGERPRINT_DRIFT/);
  await assert.rejects(() => coordinateReviewExecution({ reviewItem: { ...item, review_status: "FAILED" }, actor: "owner", adapter, now }), /REVIEW_NOT_APPROVED/);
  await assert.rejects(() => coordinateReviewExecution({ reviewItem: { ...item, retailer_id: "4", operation_type: "UPDATE_PRICE" }, actor: "owner", adapter, now }), /RETAILER_OPERATION_UNSUPPORTED/);
  assert.equal(transitionAllowed("PENDING", "APPROVED"), true);
  assert.equal(transitionAllowed("FAILED", "EXECUTING"), false);
  assert.equal(capabilityFor("1", "VERIFY_NO_CHANGE"), null);
  assert.equal(hash(before), hash(JSON.parse(JSON.stringify(before))));
});

test("automation review publisher is exact, idempotent and targets only the review queue", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "scripts", "publish-automation-review-queue.js"), "utf8");
  assert.match(source, /OWNER_APPROVED_REVIEW_QUEUE_EXACT_375/);
  assert.match(source, /retailer_id,offer_id,source_row_fingerprint/);
  assert.match(source, /already_present/);
  assert.match(source, /Review seed retailer binding mismatch/);
  assert.match(source, /catalogue_writes: 0/);
  assert.doesNotMatch(source, /\.from\("(?:products|product_variants|retailer_products|offers|price_history)"\)/);
});

test("Discount review reconciliation expires exact stale evidence without catalogue access", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "scripts", "reconcile-automation-review-queue.js"), "utf8");
  const { validateEvidencePayload } = require("./reconcile-automation-review-queue");
  const owner = require("../docs/rollouts/automation-reliability-owner-pack-2026-08-30.json");
  const zero = { products: 0, product_variants: 0, retailer_products: 0, offers: 0, price_history: 0 };
  const commercial = { offer_price_updates: 0, offer_shipping_updates: 0, offer_total_updates: 0, offer_stock_updates: 0, offer_url_updates: 0, mapping_url_updates: 0, mapping_updated_at_updates: 0 };
  const evidence = validateEvidencePayload({ result: "PASS", target: "production", approved_mapping_count: 109, review_row_count: 0, blocked_row_count: 0, classification: { VERIFY_NO_CHANGE: 109 }, expected_deltas: { row_count_deltas: zero, logical_field_deltas: commercial } }, owner);
  assert.equal(evidence.staleOfferIds.length, 47);
  assert.match(source, /EXPIRE_DISCOUNT_STALE_EVIDENCE_EXACT_47/);
  assert.match(source, /review_status: "EXPIRED"/);
  assert.match(source, /new_review_rows: 0/);
  assert.doesNotMatch(source, /\.from\("(?:products|product_variants|retailer_products|offers|price_history)"\)/);
});
