const OAUTH_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const TOKEN_SCOPE = "https://api.ebay.com/oauth/api_scope";
let tokenCache = null;

function clean(value) {
  return String(value ?? "").trim();
}

async function getApplicationToken(config, fetchImpl = fetch, now = Date.now()) {
  if (!clean(config?.client_id) || !clean(config?.client_secret)) {
    throw new Error("Missing eBay OAuth client credentials");
  }
  if (tokenCache && tokenCache.client_id === config.client_id && tokenCache.expires_at > now + 60_000) {
    return tokenCache.token;
  }
  const authorization = Buffer.from(`${config.client_id}:${config.client_secret}`).toString("base64");
  const response = await fetchImpl(OAUTH_URL, {
    method: "POST",
    headers: { Authorization: `Basic ${authorization}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", scope: TOKEN_SCOPE }),
  });
  if (!response.ok) throw new Error(`eBay OAuth failed with HTTP ${response.status}`);
  const body = await response.json();
  if (!clean(body.access_token) || !Number.isFinite(Number(body.expires_in))) {
    throw new Error("eBay OAuth returned an invalid token response");
  }
  tokenCache = {
    client_id: config.client_id,
    token: body.access_token,
    expires_at: now + Number(body.expires_in) * 1000,
  };
  return body.access_token;
}

function resetTokenCache() {
  tokenCache = null;
}

module.exports = { OAUTH_URL, TOKEN_SCOPE, getApplicationToken, resetTokenCache };
