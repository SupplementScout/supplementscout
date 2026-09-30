/* eslint-disable @typescript-eslint/no-require-imports */
const crypto = require("node:crypto");
const { getApplicationToken } = require("./ebay-oauth");

const ENDPOINT_URL = "https://www.supplementscout.co.uk/api/ebay/account-deletion";
const PUBLIC_KEY_BASE_URL = "https://api.ebay.com/commerce/notification/v1/public_key/";
const TOPIC = "MARKETPLACE_ACCOUNT_DELETION";
const MAX_BODY_BYTES = 256 * 1024;
const PUBLIC_KEY_TTL_MS = 60 * 60 * 1000;
const PUBLIC_KEY_CACHE_MAX_ENTRIES = 32;
const publicKeyCache = new Map();

const DIAGNOSTIC_CODES = Object.freeze({
  OAUTH_FAILED: "oauth_failed",
  PUBLIC_KEY_FETCH_FAILED: "public_key_fetch_failed",
  PUBLIC_KEY_INVALID: "public_key_invalid",
  SIGNATURE_REJECTED: "signature_rejected",
  PAYLOAD_ROOT_INVALID: "payload_root_invalid",
  PAYLOAD_TOPIC_INVALID: "payload_topic_invalid",
  PAYLOAD_SCHEMA_VERSION_INVALID: "payload_schema_version_invalid",
  PAYLOAD_NOTIFICATION_MISSING: "payload_notification_missing",
  PAYLOAD_NOTIFICATION_ID_INVALID: "payload_notification_id_invalid",
  PAYLOAD_DATA_MISSING: "payload_data_missing",
  PAYLOAD_IDENTITY_MISSING: "payload_identity_missing",
  PROCESSING_FAILED: "processing_failed",
});

class EbayNotificationDiagnosticError extends Error {
  constructor(diagnosticCode) {
    super(diagnosticCode);
    this.name = "EbayNotificationDiagnosticError";
    this.diagnosticCode = diagnosticCode;
  }
}

function diagnosticError(code) {
  return new EbayNotificationDiagnosticError(code);
}

/**
 * @param {unknown} error
 * @param {string} [fallback]
 * @returns {string}
 */
function getDiagnosticCode(error, fallback = DIAGNOSTIC_CODES.PROCESSING_FAILED) {
  return Object.values(DIAGNOSTIC_CODES).includes(error?.diagnosticCode)
    ? error.diagnosticCode
    : fallback;
}

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
    throw diagnosticError(DIAGNOSTIC_CODES.PUBLIC_KEY_INVALID);
  }
  try {
    crypto.createPublicKey(key);
  } catch {
    throw diagnosticError(DIAGNOSTIC_CODES.PUBLIC_KEY_INVALID);
  }
  return key;
}

function getCachedPublicKey(kid, now) {
  const cached = publicKeyCache.get(kid);
  if (!cached) return null;
  if (cached.expires_at <= now) {
    publicKeyCache.delete(kid);
    return null;
  }
  publicKeyCache.delete(kid);
  publicKeyCache.set(kid, cached);
  return cached.key;
}

function cachePublicKey(kid, key, expiresAt) {
  publicKeyCache.delete(kid);
  publicKeyCache.set(kid, { key, expires_at: expiresAt });
  while (publicKeyCache.size > PUBLIC_KEY_CACHE_MAX_ENTRIES) {
    const oldestKid = publicKeyCache.keys().next().value;
    publicKeyCache.delete(oldestKid);
  }
}

async function getNotificationPublicKey(kid, config, dependencies = {}) {
  const now = dependencies.now ?? Date.now();
  const cached = getCachedPublicKey(kid, now);
  if (cached) return cached;
  const fetchImpl = dependencies.fetchImpl || fetch;
  const tokenProvider = dependencies.tokenProvider || getApplicationToken;
  let token;
  try {
    token = await tokenProvider({ client_id: config.client_id, client_secret: config.client_secret }, fetchImpl, now);
  } catch {
    throw diagnosticError(DIAGNOSTIC_CODES.OAUTH_FAILED);
  }
  let response;
  try {
    response = await fetchImpl(`${PUBLIC_KEY_BASE_URL}${encodeURIComponent(kid)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
  } catch {
    throw diagnosticError(DIAGNOSTIC_CODES.PUBLIC_KEY_FETCH_FAILED);
  }
  if (!response.ok) throw diagnosticError(DIAGNOSTIC_CODES.PUBLIC_KEY_FETCH_FAILED);
  let body;
  try {
    body = await response.json();
  } catch {
    throw diagnosticError(DIAGNOSTIC_CODES.PUBLIC_KEY_INVALID);
  }
  const key = formatPublicKey(body?.key);
  cachePublicKey(kid, key, now + PUBLIC_KEY_TTL_MS);
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
  try {
    return verifier.verify(publicKey, signature.signature, "base64");
  } catch {
    throw diagnosticError(DIAGNOSTIC_CODES.SIGNATURE_REJECTED);
  }
}

function validateDeletionPayload(value) {
  if (!value || typeof value !== "object") {
    throw diagnosticError(DIAGNOSTIC_CODES.PAYLOAD_ROOT_INVALID);
  }
  if (value.metadata?.topic !== TOPIC) {
    throw diagnosticError(DIAGNOSTIC_CODES.PAYLOAD_TOPIC_INVALID);
  }
  if (value.metadata?.schemaVersion !== "1.0") {
    throw diagnosticError(DIAGNOSTIC_CODES.PAYLOAD_SCHEMA_VERSION_INVALID);
  }
  const notification = value.notification;
  if (!notification) {
    throw diagnosticError(DIAGNOSTIC_CODES.PAYLOAD_NOTIFICATION_MISSING);
  }
  if (!/^[A-Za-z0-9-]{8,128}$/.test(clean(notification.notificationId))) {
    throw diagnosticError(DIAGNOSTIC_CODES.PAYLOAD_NOTIFICATION_ID_INVALID);
  }
  const data = notification?.data;
  if (!data || typeof data !== "object") {
    throw diagnosticError(DIAGNOSTIC_CODES.PAYLOAD_DATA_MISSING);
  }
  if (![data.userId, data.eiasToken, data.username].some((item) => clean(item))) {
    throw diagnosticError(DIAGNOSTIC_CODES.PAYLOAD_IDENTITY_MISSING);
  }
  return value;
}

function verifiedNotificationLogContext(value) {
  const notificationId = clean(value?.notification?.notificationId);
  const publishAttemptCount = value?.notification?.publishAttemptCount;
  return {
    ...(notificationId
      ? { notification_id_sha256: crypto.createHash("sha256").update(notificationId).digest("hex") }
      : {}),
    ...(Number.isSafeInteger(publishAttemptCount) && publishAttemptCount >= 0
      ? { publish_attempt_count: publishAttemptCount }
      : {}),
  };
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
  DIAGNOSTIC_CODES,
  ENDPOINT_URL,
  MAX_BODY_BYTES,
  PUBLIC_KEY_BASE_URL,
  PUBLIC_KEY_CACHE_MAX_ENTRIES,
  PUBLIC_KEY_TTL_MS,
  TOPIC,
  assertEndpointRequest,
  assertVerificationToken,
  decodeSignatureHeader,
  generateChallengeResponse,
  getDiagnosticCode,
  getNotificationPublicKey,
  processDeletionNotification,
  resetPublicKeyCache,
  validateDeletionPayload,
  verifiedNotificationLogContext,
  verifyNotificationSignature,
};
