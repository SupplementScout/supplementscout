export const MY_SUPPLEMENTS_STORAGE_KEY = "supplementscout_my_supplements_v1";
export const MY_SUPPLEMENTS_SCHEMA_VERSION = 1;
export const MY_SUPPLEMENTS_MAX_ITEMS = 30;
export const MY_SUPPLEMENTS_MAX_BYTES = 100_000;
export const MY_SUPPLEMENTS_CHANGED_EVENT = "supplementscout:my-supplements-changed";

export type MySupplementUnit = "unit" | "gram" | "serving" | "pack";

export type MySupplementEntry = {
  productId: string;
  slug: string | null;
  variantId: string;
  display: {
    name: string;
    brand: string | null;
    pack: string | null;
  };
  remaining: {
    amount: number;
    unit: MySupplementUnit;
  };
  dailyUse: {
    amount: number;
    unit: MySupplementUnit;
  };
  countDate: string;
  reorderBufferDays: number;
  lastPricePaid: number | null;
  currency: "GBP";
  createdAt: string;
  updatedAt: string;
};

export type MySupplementsDocument = {
  version: 1;
  items: MySupplementEntry[];
};

export type MySupplementsStorage = Pick<Storage, "getItem" | "setItem">;

export type MySupplementsImportPreview = {
  document: MySupplementsDocument;
  incomingCount: number;
  newCount: number;
  replacementCount: number;
};

const UNITS = new Set<MySupplementUnit>(["unit", "gram", "serving", "pack"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveId(value: unknown): value is string {
  return typeof value === "string" && /^[1-9][0-9]*$/.test(value);
}

function isIsoDate(value: unknown) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function finiteNumber(value: unknown, options: { minimum: number; maximum: number }) {
  return typeof value === "number" && Number.isFinite(value) && value >= options.minimum && value <= options.maximum;
}

function optionalShortString(value: unknown, maximum: number) {
  return value === null || (typeof value === "string" && value.length > 0 && value.length <= maximum);
}

function parseEntry(value: unknown): MySupplementEntry | null {
  if (!isRecord(value) || !isRecord(value.display) || !isRecord(value.remaining) || !isRecord(value.dailyUse)) {
    return null;
  }

  const remainingUnit = value.remaining.unit;
  const dailyUnit = value.dailyUse.unit;
  if (
    !isPositiveId(value.productId) ||
    !isPositiveId(value.variantId) ||
    !optionalShortString(value.slug, 180) ||
    typeof value.display.name !== "string" ||
    value.display.name.length < 1 ||
    value.display.name.length > 240 ||
    !optionalShortString(value.display.brand, 160) ||
    !optionalShortString(value.display.pack, 160) ||
    !UNITS.has(remainingUnit as MySupplementUnit) ||
    !UNITS.has(dailyUnit as MySupplementUnit) ||
    remainingUnit !== dailyUnit ||
    !finiteNumber(value.remaining.amount, { minimum: 0, maximum: 1_000_000 }) ||
    !finiteNumber(value.dailyUse.amount, { minimum: 0.0001, maximum: 100_000 }) ||
    !isIsoDate(value.countDate) ||
    !Number.isInteger(value.reorderBufferDays) ||
    !finiteNumber(value.reorderBufferDays, { minimum: 0, maximum: 90 }) ||
    !(value.lastPricePaid === null || finiteNumber(value.lastPricePaid, { minimum: 0.01, maximum: 1_000_000 })) ||
    value.currency !== "GBP" ||
    !isIsoDate(value.createdAt) ||
    !isIsoDate(value.updatedAt)
  ) {
    return null;
  }

  return value as unknown as MySupplementEntry;
}

export function mySupplementKey(item: Pick<MySupplementEntry, "productId" | "variantId">) {
  return `${item.productId}:${item.variantId}`;
}

export function parseMySupplementsDocument(raw: string | null): MySupplementsDocument | null {
  if (raw === null || raw.length === 0 || raw.length > MY_SUPPLEMENTS_MAX_BYTES) return null;

  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || value.version !== MY_SUPPLEMENTS_SCHEMA_VERSION || !Array.isArray(value.items)) return null;
    if (value.items.length > MY_SUPPLEMENTS_MAX_ITEMS) return null;

    const items = value.items.map(parseEntry);
    if (items.some((item) => item === null)) return null;

    const typedItems = items as MySupplementEntry[];
    const keys = new Set(typedItems.map(mySupplementKey));
    if (keys.size !== typedItems.length) return null;

    return { version: MY_SUPPLEMENTS_SCHEMA_VERSION, items: typedItems };
  } catch {
    return null;
  }
}

export function emptyMySupplementsDocument(): MySupplementsDocument {
  return { version: MY_SUPPLEMENTS_SCHEMA_VERSION, items: [] };
}

export function readMySupplements(storage: MySupplementsStorage | null) {
  if (!storage) return emptyMySupplementsDocument();
  try {
    return parseMySupplementsDocument(storage.getItem(MY_SUPPLEMENTS_STORAGE_KEY)) || emptyMySupplementsDocument();
  } catch {
    return emptyMySupplementsDocument();
  }
}

export function persistMySupplements(storage: MySupplementsStorage | null, document: MySupplementsDocument) {
  if (!storage) return false;
  const checked = parseMySupplementsDocument(JSON.stringify(document));
  if (!checked) return false;
  try {
    storage.setItem(MY_SUPPLEMENTS_STORAGE_KEY, JSON.stringify(checked));
    return true;
  } catch {
    return false;
  }
}

export function upsertMySupplement(document: MySupplementsDocument, entry: MySupplementEntry): MySupplementsDocument {
  const checked = parseEntry(entry);
  if (!checked) return document;
  const key = mySupplementKey(checked);
  const existing = document.items.find((item) => mySupplementKey(item) === key);
  const items = document.items.filter((item) => mySupplementKey(item) !== key);
  items.unshift({ ...checked, createdAt: existing?.createdAt || checked.createdAt });
  return items.length <= MY_SUPPLEMENTS_MAX_ITEMS
    ? { version: MY_SUPPLEMENTS_SCHEMA_VERSION, items }
    : document;
}

export function removeMySupplement(document: MySupplementsDocument, key: string) {
  return {
    version: MY_SUPPLEMENTS_SCHEMA_VERSION,
    items: document.items.filter((item) => mySupplementKey(item) !== key),
  } as MySupplementsDocument;
}

export function previewMySupplementsImport(raw: string, current: MySupplementsDocument): MySupplementsImportPreview | null {
  const incoming = parseMySupplementsDocument(raw);
  if (!incoming) return null;
  const currentKeys = new Set(current.items.map(mySupplementKey));
  const replacementCount = incoming.items.filter((item) => currentKeys.has(mySupplementKey(item))).length;
  return {
    document: incoming,
    incomingCount: incoming.items.length,
    newCount: incoming.items.length - replacementCount,
    replacementCount,
  };
}

export function applyMySupplementsImport(
  current: MySupplementsDocument,
  incoming: MySupplementsDocument,
  mode: "merge" | "replace"
) {
  if (mode === "replace") return incoming;
  const incomingKeys = new Set(incoming.items.map(mySupplementKey));
  const items = [...incoming.items, ...current.items.filter((item) => !incomingKeys.has(mySupplementKey(item)))];
  return items.length <= MY_SUPPLEMENTS_MAX_ITEMS
    ? { version: MY_SUPPLEMENTS_SCHEMA_VERSION, items } as MySupplementsDocument
    : null;
}

export function exportMySupplements(document: MySupplementsDocument) {
  return JSON.stringify(document, null, 2);
}

export function notifyMySupplementsChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(MY_SUPPLEMENTS_CHANGED_EVENT));
}

