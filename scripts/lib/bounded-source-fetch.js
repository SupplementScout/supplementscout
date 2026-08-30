const TRANSIENT_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function boundedSourceFetch(
  url,
  init = {},
  {
    fetchImpl = globalThis.fetch,
    maximumAttempts = 3,
    retryBaseDelayMs = 250,
    sleepImpl = sleep,
    timeoutMs = 20_000,
  } = {},
) {
  invariant(typeof fetchImpl === "function", "Source fetch implementation is required");
  invariant(Number.isInteger(maximumAttempts) && maximumAttempts >= 1 && maximumAttempts <= 5, "Source maximum attempts must be 1..5");
  invariant(Number.isInteger(retryBaseDelayMs) && retryBaseDelayMs >= 0 && retryBaseDelayMs <= 30_000, "Source retry delay is invalid");
  invariant(Number.isInteger(timeoutMs) && timeoutMs >= 1 && timeoutMs <= 120_000, "Source timeout is invalid");
  invariant(!init.signal, "Source fetch signal is managed by bounded retry");

  let lastError = null;
  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, { ...init, signal: controller.signal });
      const transient = TRANSIENT_STATUSES.has(Number(response.status));
      if (!transient || attempt === maximumAttempts) {
        return { response, attempts: attempt, retry_count: attempt - 1 };
      }
      await response.body?.cancel?.();
    } catch (error) {
      lastError = error;
      if (attempt === maximumAttempts) {
        if (error && typeof error === "object") {
          error.source_retry = { attempts: attempt, retry_count: attempt - 1 };
        }
        throw error;
      }
    } finally {
      clearTimeout(timer);
    }
    await sleepImpl(retryBaseDelayMs * attempt);
  }

  throw lastError || new Error("Source fetch retry exhausted");
}

module.exports = { TRANSIENT_STATUSES, boundedSourceFetch };
