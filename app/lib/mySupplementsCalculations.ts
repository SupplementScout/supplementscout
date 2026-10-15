import type { MySupplementEntry } from "./mySupplements";

const DAY_MS = 86_400_000;

function validDate(value: string) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

export function calculateMySupplementSchedule(entry: MySupplementEntry) {
  const countTime = validDate(entry.countDate);
  if (countTime === null || entry.remaining.amount < 0 || entry.dailyUse.amount <= 0) return null;

  const rawDaysRemaining = entry.remaining.amount / entry.dailyUse.amount;
  if (!Number.isFinite(rawDaysRemaining) || rawDaysRemaining > 3650) return null;
  const daysRemaining = Math.floor(rawDaysRemaining);
  const runOutAt = new Date(countTime + daysRemaining * DAY_MS);
  const reorderAt = new Date(runOutAt.getTime() - entry.reorderBufferDays * DAY_MS);
  return { daysRemaining, runOutAt, reorderAt };
}

export function calculateRecurringCost(options: {
  packAmount: number | null;
  packUnit: MySupplementEntry["dailyUse"]["unit"] | null;
  dailyAmount: number;
  dailyUnit: MySupplementEntry["dailyUse"]["unit"];
  price: number | null;
}) {
  if (
    options.packAmount === null ||
    options.packUnit === null ||
    options.price === null ||
    options.packUnit !== options.dailyUnit ||
    !Number.isFinite(options.packAmount) ||
    options.packAmount <= 0 ||
    !Number.isFinite(options.dailyAmount) ||
    options.dailyAmount <= 0 ||
    !Number.isFinite(options.price) ||
    options.price <= 0
  ) return null;

  const daily = (options.price / options.packAmount) * options.dailyAmount;
  return { daily, monthly: daily * 30, yearly: daily * 365 };
}

