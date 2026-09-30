// Phase D — real engineer utilization/revenue math. Nothing here is
// stored: hours, revenue, and commission are computed live from real
// project_sessions/bookings/payments, same "derive, don't store"
// principle as lib/membership-usage.ts.

import { bookingHours } from "./membership-usage";

export type SessionForMetrics = {
  starts_at: string | null;
  ends_at: string | null;
  status: string;
  booking_id: string | null;
};

export type BookingForMetrics = {
  id: string;
  start_time: string | null;
  end_time: string | null;
  status: string;
};

function sessionHours(startsAt: string | null, endsAt: string | null): number {
  if (!startsAt || !endsAt) return 0;
  const ms = new Date(endsAt).getTime() - new Date(startsAt).getTime();
  return ms > 0 ? ms / (1000 * 60 * 60) : 0;
}

export type EngineerHours = {
  scheduledHours: number;
  completedHours: number;
  cancelledHours: number;
  noShowHours: number;
  /** completed / (completed + cancelled + no_show) — how much of the
   * engineer's booked time was actually delivered. Null when there's no
   * finished session/booking to measure yet, rather than a fabricated 0%. */
  utilizationPercentage: number | null;
};

/**
 * Combines project_sessions (Phase A studio production) and standalone
 * bookings (Square-sourced, Phase 3) for one engineer. A booking that's
 * already linked to a project_session (session.booking_id) is excluded
 * from the bookings side so its hours are never counted twice.
 */
export function computeEngineerHours(sessions: SessionForMetrics[], bookings: BookingForMetrics[]): EngineerHours {
  const linkedBookingIds = new Set(sessions.map((s) => s.booking_id).filter((id): id is string => !!id));
  const standaloneBookings = bookings.filter((b) => !linkedBookingIds.has(b.id));

  let scheduledHours = 0;
  let completedHours = 0;
  let cancelledHours = 0;
  let noShowHours = 0;

  for (const s of sessions) {
    const h = sessionHours(s.starts_at, s.ends_at);
    if (s.status === "scheduled" || s.status === "in_progress") scheduledHours += h;
    else if (s.status === "completed") completedHours += h;
    else if (s.status === "cancelled") cancelledHours += h;
    else if (s.status === "no_show") noShowHours += h;
  }

  for (const b of standaloneBookings) {
    const h = bookingHours(b.start_time, b.end_time);
    if (b.status === "pending" || b.status === "confirmed") scheduledHours += h;
    else if (b.status === "completed") completedHours += h;
    else if (b.status === "cancelled") cancelledHours += h;
    else if (b.status === "no_show") noShowHours += h;
  }

  const finishedDenominator = completedHours + cancelledHours + noShowHours;
  const utilizationPercentage = finishedDenominator > 0 ? (completedHours / finishedDenominator) * 100 : null;

  return { scheduledHours, completedHours, cancelledHours, noShowHours, utilizationPercentage };
}

export function computeCommission(revenue: number, commissionRate: number | null): number | null {
  return commissionRate !== null ? revenue * (commissionRate / 100) : null;
}
