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
  assert.match(page, /await requireAdminPage\(\)/);
  assert.match(page, /pageSize = 50/);
  assert.match(page, /PENDING.*APPROVED.*REJECTED.*IGNORED.*EXPIRED.*EXECUTING.*EXECUTED.*FAILED/s);
  assert.match(page, /Freshness-only.*Stock and price.*Identity.*Source problems/s);
  assert.match(page, /AUTONOMOUS.*REVIEW_EXECUTABLE.*REVIEW_ONLY.*UNSUPPORTED/s);
  assert.match(page, /All confidence/);
  assert.match(page, /capabilityForReview/);
  assert.match(page, /decisionGroupForReview/);
  assert.match(page, /confidenceForReview/);
  assert.match(page, /before_state.*proposed_state.*impact_summary.*source_evidence/);
  assert.match(page, /Compatible selected rows/);
  assert.match(page, /Approve decision/);
  assert.match(page, /Execute approved/);
  assert.match(page, /Approval alone has not changed the catalogue/);
  assert.match(page, /existing protected importer approval and executor RPCs/);
  assert.match(page, /Execution adapter/);
  assert.match(page, /Recommended decision/);
  assert.match(page, /Capability note/);
  assert.match(page, /Disabled reason/);
  assert.match(page, /confirmExecution/);
  assert.match(page, /disabled=\{!adapterReady\}/);
  assert.match(page, /Execution history/);
  assert.match(page, /idempotency_result/);
});

test("automation review capability matrix groups remaining retailers without widening execution registry", () => {
  const matrixSource = fs.readFileSync(path.join(process.cwd(), "app", "lib", "automationReviewCapabilityMatrix.ts"), "utf8");
  const adapterSource = fs.readFileSync(path.join(process.cwd(), "app", "lib", "automationReviewAdapters.ts"), "utf8");
  for (const retailer of ["Whey Okay", "Discount Supplements", "Dolphin Fitness", "GYM HIGH", "Simply Supplements", "6 Pack Supplements", "KIOR Health", "Fit House", "Jon's Supplements", "eBay UK"]) assert.match(matrixSource, new RegExp(retailer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  for (const operation of ["VERIFY_NO_CHANGE", "UPDATE_PRICE", "UPDATE_STOCK", "UPDATE_PRICE_AND_STOCK", "IDENTITY_PROMOTION", "REBIND_EXISTING_VARIANT", "SOURCE_MISSING", "UNAVAILABLE_DECISION"]) assert.match(matrixSource, new RegExp(operation));
  for (const capability of ["AUTONOMOUS", "REVIEW_EXECUTABLE", "REVIEW_ONLY", "UNSUPPORTED"]) assert.match(matrixSource, new RegExp(capability));
  assert.match(matrixSource, /capabilityForReview/);
  assert.match(matrixSource, /decisionGroupForReview/);
  assert.match(matrixSource, /confidenceForReview/);
  assert.equal((adapterSource.match(/retailerSlug: "ebay-uk"/g) || []).length, 1);
  assert.doesNotMatch(adapterSource, /UPDATE_PRICE|UPDATE_STOCK|REBIN|MARK_OOS/);
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
  assert.match(source, /decision_actor/);
  assert.match(source, /variant\.product_id/);
  assert.doesNotMatch(source, /\.from\("(?:products|product_variants|retailer_products|offers|price_history)"\)\.update/);
});

test("automation review execute action authenticates, queues idempotently and dispatches only a protected adapter", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "app", "admin", "automation-review", "execute", "route.ts"), "utf8");
  const handler = source.slice(source.indexOf("export async function POST"));
  assert(handler.indexOf("requireAdminRoute(request)") < handler.indexOf("request.formData()"));
  assert.match(source, /review_status !== "APPROVED"/);
  assert.match(source, /Date\.parse\(data\.expires_at\) <= Date\.now\(\)/);
  assert.match(source, /resolveReviewAdapter/);
  assert.match(source, /reviewDispatchConfigured/);
  assert.match(source, /queue_automation_review_execution/);
  assert.match(source, /already_queued/);
  assert.match(source, /idempotencyKey/);
  assert.match(source, /execution_mode: "review-queue"/);
  assert.match(source, /review_plan_fingerprint: data\.plan_fingerprint/);
  assert.match(source, /execution_idempotency_key: key/);
  assert.match(source, /record_automation_review_execution_checkpoint/);
  assert(source.indexOf('"DISPATCH_STARTED"') < source.indexOf("await fetch("));
  assert.match(source, /authorization: `Bearer \$\{token\}`/);
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY.*body|DATABASE_URL.*body/s);
  assert.doesNotMatch(source, /approve_product_import_plan|apply_approved_product_import_plan/);
  assert.doesNotMatch(source, /\.from\("(?:products|product_variants|retailer_products|offers|price_history)"\)/);
});

test("automation review adapter registry is exact, default-deny and freshness-only", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "app", "lib", "automationReviewAdapters.ts"), "utf8");
  assert.equal((source.match(/retailerSlug: "ebay-uk"/g) || []).length, 1);
  assert.match(source, /retailerId: "12"/);
  assert.match(source, /retailerSlug: "ebay-uk"/);
  assert.match(source, /operations: Object\.freeze\(\["VERIFY_NO_CHANGE"\]\)/);
  assert.match(source, /reasonCodes: Object\.freeze\(\["FRESHNESS_CONFIRMATION", "STALE_OFFER", "NO_CHANGE_CONFIRMATION"\]\)/);
  assert.match(source, /maximumBatch: 1/);
  assert.match(source, /isolation: "per-row"/);
  assert.match(source, /reviewBinding: "immutable-review-record"/);
  assert.match(source, /kind: "github-artifact"/);
  for (const input of ["approved_dry_run_id", "approved_artifact_id", "approved_commit_sha", "approved_full_capture_fingerprint", "approved_executable_source_fingerprint", "approved_review_scope_fingerprint", "approved_plan_fingerprint", "approved_manifest_sha256", "approved_report_sha256", "owner_confirmation"]) assert.match(source, new RegExp(input));
  assert.match(source, /EXECUTION_UNSUPPORTED/);
  assert.doesNotMatch(source, /UPDATE_PRICE|UPDATE_STOCK|REBIN|MARK_OOS/);
});

test("automation review UI exposes executable versus review drift scope", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "app", "admin", "automation-review", "page.tsx"), "utf8");
  assert.match(source, /source_evidence\?\.drift_scope/);
  assert.match(source, /Drift scope: \{driftScope\}/);
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
  const { parseArgs, assertContext } = require("./automation-review-ebay-worker");
  const args = ["--review-item-id=7", "--execution-request-id=11111111-1111-4111-8111-111111111111", "--retailer=ebay-uk", `--review-fingerprint=${"a".repeat(64)}`, `--review-plan-fingerprint=${"b".repeat(64)}`, `--execution-idempotency-key=${"c".repeat(64)}`, "--mode=review-queue"];
  assert.deepEqual(parseArgs(args), { reviewItemId: "7", executionRequestId: "11111111-1111-4111-8111-111111111111", retailer: "ebay-uk", reviewFingerprint: "a".repeat(64), reviewPlanFingerprint: "b".repeat(64), executionIdempotencyKey: "c".repeat(64), mode: "review-queue" });
  assert.throws(() => parseArgs(args.map((value) => value.startsWith("--execution-request-id=") ? "--execution-request-id=bad" : value)), /EXECUTION_REQUEST_ID_INVALID/);
  assert.throws(() => assertContext({}), /WORKER_CONTEXT_INVALID/);
  assert.match(source, /request\.status === "DISPATCHED"/);
  assert.match(source, /review\.review_status === "APPROVED"/);
  assert.match(source, /event\.source_row_fingerprint === review\.source_row_fingerprint/);
  assert.match(source, /event\.plan_fingerprint === review\.plan_fingerprint/);
  assert.match(source, /SOURCE_FINGERPRINT_DRIFT/);
  assert.match(source, /PLAN_FINGERPRINT_DRIFT/);
  assert.match(source, /DATABASE_BEFORE_STATE_DRIFT/);
  assert.match(source, /OFFER_2686_FORBIDDEN/);
  assert.match(source, /APPLY_RESULT_SCOPE_DRIFT/);
  assert.match(source, /actionForPlan\(fresh\.approved\.entry\.resolved_plan\) === "VERIFY_NO_CHANGE"/);
  assert.match(source, /price_history_delta/);
  assert.doesNotMatch(source, /\b(?:insert into|update|delete from)\s+(?:public\.)?(?:products|product_variants|retailer_products|offers|price_history)\b/i);
});

test("Review Queue stale-state hashing canonicalizes equivalent timestamps without losing microseconds", () => {
  const { hash } = require("./automation-review-ebay-worker");
  assert.equal(
    hash({ offer: { last_checked_at: "2026-08-30T14:11:22.619000Z" }, source_captured_at: "2026-08-30T14:11:23Z" }),
    hash({ offer: { last_checked_at: "2026-08-30T14:11:22.619Z" }, source_captured_at: "2026-08-30T15:11:23+01:00" }),
  );
  assert.notEqual(hash({ last_checked_at: "2026-08-30T14:11:22.619001Z" }), hash({ last_checked_at: "2026-08-30T14:11:22.619000Z" }));
});

test("eBay workflow isolates Review Queue dispatch payload and protected credentials", () => {
  const workflow = fs.readFileSync(path.join(process.cwd(), ".github", "workflows", "ebay-offer-refresh.yml"), "utf8");
  assert.match(workflow, /execution_mode:[\s\S]*options: \[catalogue-refresh, review-queue\]/);
  assert.match(workflow, /review_item_id:[\s\S]*execution_request_id:[\s\S]*review_fingerprint:/);
  assert.match(workflow, /review_plan_fingerprint:[\s\S]*execution_idempotency_key:/);
  assert.match(workflow, /review-execution:[\s\S]*environment: production-readonly/);
  assert.match(workflow, /inputs\.operation == 'apply'.*inputs\.execution_mode == 'review-queue'/);
  assert.match(workflow, /automation-review-ebay-worker\.js/);
  assert.match(workflow, /persist-credentials: false/);
  assert.doesNotMatch(workflow, /\$\{\{ secrets\.[^}]+ \}\}.*review_(?:item|fingerprint)/);
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
