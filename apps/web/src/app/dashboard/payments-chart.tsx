"use client";

import { useState } from "react";
// Type-only: this runs in the browser, where the server module must never go.
import type { PaymentDay } from "@/server/activity/activity-service";
import styles from "./dashboard.module.css";

const dayName = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", timeZone: "UTC" });

function payments(count: number): string {
  return count === 1 ? "1 payment" : `${String(count)} payments`;
}

function label(day: PaymentDay): string {
  return `${dayName.format(new Date(`${day.date}T00:00:00Z`))}: ${payments(day.payments)}`;
}

// Payments per day, one bar a day, today last. One series in the brand
// violet; pointing at a bar shows its day in the line above the chart.
export function PaymentsChart({ days }: { days: PaymentDay[] }) {
  const [pointed, setPointed] = useState<PaymentDay | null>(null);
  const total = days.reduce((sum, day) => sum + day.payments, 0);
  const most = Math.max(1, ...days.map((day) => day.payments));
  const activeDays = days.filter((day) => day.payments > 0).length;
  const busiest = days.find((day) => day.payments === most && most > 1);
  const summary =
    total === 0
      ? `No payments in the last ${String(days.length)} days.`
      : `${payments(total)} in the last ${String(days.length)} days, on ${activeDays === 1 ? "1 day" : `${String(activeDays)} days`}${busiest === undefined ? "" : `; the busiest was ${label(busiest)}`}.`;

  return (
    <figure className={styles.chart}>
      <figcaption className={styles.chartCaption} aria-live="polite">
        {pointed === null ? `Last ${String(days.length)} days: ${payments(total)}` : label(pointed)}
      </figcaption>
      <div
        className={styles.chartBars}
        role="img"
        aria-label={summary}
        onPointerLeave={() => {
          setPointed(null);
        }}
      >
        {days.map((day) => (
          <span
            key={day.date}
            className={styles.chartSlot}
            onPointerEnter={() => {
              setPointed(day);
            }}
          >
            <span
              className={day.payments === 0 ? styles.chartEmpty : styles.chartBar}
              style={{
                height: day.payments === 0 ? undefined : `${String((day.payments / most) * 100)}%`,
              }}
            />
          </span>
        ))}
      </div>
      <div className={styles.chartAxis} aria-hidden="true">
        <span>
          {days[0] === undefined ? "" : dayName.format(new Date(`${days[0].date}T00:00:00Z`))}
        </span>
        <span>Today</span>
      </div>
    </figure>
  );
}
