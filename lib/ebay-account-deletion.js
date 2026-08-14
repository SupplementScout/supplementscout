/* eslint-disable @typescript-eslint/no-require-imports */
const crypto = require("node:crypto");
const { getApplicationToken } = require("./ebay-oauth");

const ENDPOINT_URL = "https://www.supplementscout.co.uk/api/ebay/account-deletion";
const PUBLIC_KEY_BASE_URL = "https://api.ebay.com/commerce/notification/v1/public_key/";
const TOPIC = "MARKETPLACE_ACCOUNT_DELETION";
const MAX_BODY_BYTES = 256 * 1024;
const PUBLIC_KEY_TTL_MS = 60 * 60 * 1000;
const publicKeyCache = new Map();

function clean(value) {
  return String(value ?? "").trim();
}

function assertVerificationToken(value) {
  const token = clean(value);
  if (!/^[A-Za-z0-9_-]{32,80}$/.test(token)) {
    throw new Error("EBAY_NOTIFICATION_VERIFICATION_TOKEN must contain 32-80 allowed characters");
  }
  return token;
}

function assertEndpointRequest(requestUrl) {
  const request = new URL(requestUrl);
  const endpoint = new URL(ENDPOINT_URL);
  if (request.protocol !== "https:" || request.origin !== endpoint.origin || request.pathname !== endpoint.pathname) {
    throw new Error("eBay notification endpoint URL mismatch");
  }
}

function generateChallengeResponse(challengeCode, verificationToken) {
  const challenge = clean(challengeCode);
  if (!challenge || challenge.length > 256) throw new Error("Invalid eBay challenge code");
  const token = assertVerificationToken(verificationToken);
  return crypto.createHash("sha256").update(challenge).update(token).update(ENDPOINT_URL).digest("hex");
}

function decodeSignatureHeader(value) {
  const encoded = clean(value);
  if (!encoded || encoded.length > 4096 || !/^[A-Za-z0-9+/=]+$/.test(encoded)) {
    throw new Error("Invalid X-EBAY-SIGNATURE header");
  }
  let parsed;
  try {
    parsed = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  } catch {
    throw new Error("Invalid X-EBAY-SIGNATURE header");
  }
  if (!/^[A-Za-z0-9._:-]{1,256}$/.test(clean(parsed?.kid)) || !/^[A-Za-z0-9+/=]+$/.test(clean(parsed?.signature))) {
    throw new Error("Invalid X-EBAY-SIGNATURE payload");
  }
  return { kid: clean(parsed.kid), signature: clean(parsed.signature) };
}

function formatPublicKey(value) {
  const key = clean(value).replace(/-----BEGIN PUBLIC KEY-----\s*/, "-----BEGIN PUBLIC KEY-----\n")
    .replace(/\s*-----END PUBLIC KEY-----/, "\n-----END PUBLIC KEY-----");
  if (!key.startsWith("-----BEGIN PUBLIC KEY-----\n") || !key.endsWith("\n-----END PUBLIC KEY-----")) {
    throw new Error("eBay returned an invalid notification public key");
  }
  return key;
}

async function getNotificationPublicKey(kid, config, dependencies = {}) {
  const now = dependencies.now ?? Date.now();
  const cached = publicKeyCache.get(kid);
  if (cached && cached.expires_at > now) return cached.key;
  const fetchImpl = dependencies.fetchImpl || fetch;
  const tokenProvider = dependencies.tokenProvider || getApplicationToken;
  const token = await tokenProvider({ client_id: config.client_id, client_secret: config.client_secret }, fetchImpl, now);
  const response = await fetchImpl(`${PUBLIC_KEY_BASE_URL}${encodeURIComponent(kid)}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`eBay notification public key retrieval failed with HTTP ${response.status}`);
  const body = await response.json();
  const key = formatPublicKey(body?.key);
  publicKeyCache.set(kid, { key, expires_at: now + PUBLIC_KEY_TTL_MS });
  return key;
}

async function verifyNotificationSignature(rawBody, signatureHeader, config, dependencies = {}) {
  if (typeof rawBody !== "string" || Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    throw new Error("Invalid eBay notification body");
  }
  const signature = decodeSignatureHeader(signatureHeader);
  const publicKey = await getNotificationPublicKey(signature.kid, config, dependencies);
  const verifier = crypto.createVerify("sha1");
  verifier.update(rawBody, "utf8");
  verifier.end();
  return verifier.verify(publicKey, signature.signature, "base64");
}

function validateDeletionPayload(value) {
  if (!value || typeof value !== "object" || value.metadata?.topic !== TOPIC || value.metadata?.schemaVersion !== "1.0") {
    throw new Error("Unsupported eBay notification payload");
  }
  const notification = value.notification;
  const data = notification?.data;
  if (!notification || !/^[A-Za-z0-9-]{8,128}$/.test(clean(notification.notificationId)) || !data || typeof data !== "object") {
    throw new Error("Invalid eBay account-deletion notification");
  }
  if (![data.userId, data.eiasToken, data.username].some((item) => clean(item))) {
    throw new Error("eBay account-deletion identity is missing");
  }
  return value;
}

function processDeletionNotification(value) {
  validateDeletionPayload(value);
  // SupplementScout currently has no production eBay offer, seller or user-data store.
  // This explicit no-op boundary must be replaced before any such production store is introduced.
  return { deleted_records: 0, persisted_ebay_user_data_stores: 0 };
}

function resetPublicKeyCache() {
  publicKeyCache.clear();
}

module.exports = {
  ENDPOINT_URL,
  MAX_BODY_BYTES,
  PUBLIC_KEY_BASE_URL,
  TOPIC,
  assertEndpointRequest,
  assertVerificationToken,
  decodeSignatureHeader,
  generateChallengeResponse,
  getNotificationPublicKey,
  processDeletionNotification,
  resetPublicKeyCache,
  validateDeletionPayload,
  verifyNotificationSignature,
};
