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

test("merge, ignore, and restore routes authenticate before parsing, queries, and writes", () => {
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

test("existing bigint ID handling remains string-safe", () => {
  const hugeA = "90071992547409931234";
  const hugeB = "80000000000000000001";

  assert.deepEqual(getDuplicatePairIds(hugeA, hugeB), [hugeB, hugeA]);
});
