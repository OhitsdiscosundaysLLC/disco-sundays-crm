// Phase C — real membership usage/period math. Nothing here is stored:
// used/remaining hours and usage % are computed live from real completed
// bookings attributed via bookings.membership_id (D-017 precedent), scoped
// to the membership's current billing period — derived from start_date +
// billing_interval rather than a separate invented "periods" table.

export type BillingInterval = "monthly" | "quarterly" | "annual" | "one_time";

const MONTHS_PER_INTERVAL: Record<Exclude<BillingInterval, "one_time">, number> = {
  monthly: 1,
  quarterly: 3,
  annual: 12,
};

function addMonthsUTC(date: Date, months: number): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate()));
  return d;
}

function parseDateOnly(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

/**
 * The membership's current billing period as [start, end) date-only bounds.
 * one_time plans never reset — the "period" is the membership's entire
 * lifetime, so usage is a lifetime total rather than resetting monthly.
 */
export function currentPeriodBounds(
  startDate: string,
  interval: BillingInterval,
  asOf: Date = new Date()
): { start: Date; end: Date } {
  const start = parseDateOnly(startDate);

  if (interval === "one_time") {
    return { start, end: new Date(Date.UTC(9999, 0, 1)) };
  }

  const months = MONTHS_PER_INTERVAL[interval];
  let periodStart = start;
  let periodEnd = addMonthsUTC(periodStart, months);

  // Step forward until the period brackets "today" — real math over the
  // real start_date, not a guessed or fabricated window.
  let guard = 0;
  while (periodEnd.getTime() <= asOf.getTime() && guard < 2400) {
    periodStart = periodEnd;
    periodEnd = addMonthsUTC(periodStart, months);
    guard++;
  }

  return { start: periodStart, end: periodEnd };
}

/** Parses "HH:MM:SS" (Postgres `time`) into hours since midnight. */
function timeToHours(value: string): number {
  const [h, m, s] = value.split(":").map(Number);
  return (h ?? 0) + (m ?? 0) / 60 + (s ?? 0) / 3600;
}

/**
 * Hours for one booking. Returns 0 (not counted) when either time is
 * missing — an honest signal beats guessing a default session length.
 */
export function bookingHours(startTime: string | null, endTime: string | null): number {
  if (!startTime || !endTime) return 0;
  const hours = timeToHours(endTime) - timeToHours(startTime);
  return hours > 0 ? hours : 0;
}

export type MembershipUsage = {
  usedHours: number;
  includedHours: number | null;
  remainingHours: number | null;
  usagePercentage: number | null;
  overageHours: number;
  periodStart: Date;
  periodEnd: Date;
};

export function computeMembershipUsage(params: {
  startDate: string;
  billingInterval: string;
  includedHours: number | null;
  completedBookings: { start_time: string | null; end_time: string | null; date: string }[];
  asOf?: Date;
}): MembershipUsage {
  const interval: BillingInterval = (["monthly", "quarterly", "annual", "one_time"] as const).includes(
    params.billingInterval as BillingInterval
  )
    ? (params.billingInterval as BillingInterval)
    : "monthly";

  const { start, end } = currentPeriodBounds(params.startDate, interval, params.asOf ?? new Date());

  const usedHours = params.completedBookings
    .filter((b) => {
      const d = parseDateOnly(b.date);
      return d.getTime() >= start.getTime() && d.getTime() < end.getTime();
    })
    .reduce((sum, b) => sum + bookingHours(b.start_time, b.end_time), 0);

  const includedHours = params.includedHours;
  const remainingHours = includedHours !== null ? Math.max(includedHours - usedHours, 0) : null;
  const usagePercentage = includedHours && includedHours > 0 ? (usedHours / includedHours) * 100 : null;
  const overageHours = includedHours !== null ? Math.max(usedHours - includedHours, 0) : 0;

  return { usedHours, includedHours, remainingHours, usagePercentage, overageHours, periodStart: start, periodEnd: end };
}

export function monthlyEquivalentPrice(price: number | null, interval: string): number {
  if (price === null) return 0;
  if (interval === "quarterly") return price / 3;
  if (interval === "annual") return price / 12;
  if (interval === "one_time") return 0;
  return price;
}
