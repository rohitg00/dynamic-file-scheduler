import type { FileSchedule } from "../types";

/**
 * Calculate the next run time for a schedule based on its type and configuration
 */
export function calculateNextRun(
  scheduleType: FileSchedule["scheduleType"],
  config: FileSchedule["config"],
  timezone: string = "UTC"
): Date {
  const now = new Date();

  switch (scheduleType) {
    case "daily":
      return calculateDailyNextRun(now, config.time || "09:00", timezone);

    case "weekly":
      return calculateWeeklyNextRun(
        now,
        config.dayOfWeek || "monday",
        config.time || "09:00",
        timezone
      );

    case "monthly-first-weekday":
      return calculateMonthlyFirstWeekdayNextRun(
        now,
        config.dayOfWeek || "monday",
        config.time || "09:00",
        timezone
      );

    case "monthly-last-weekday":
      return calculateMonthlyLastWeekdayNextRun(
        now,
        config.dayOfWeek || "monday",
        config.time || "09:00",
        timezone
      );

    case "custom":
      // For custom cron expressions, you might want to use a library like 'cron-parser'
      // For now, we'll default to daily
      return calculateDailyNextRun(now, config.time || "09:00", timezone);

    default:
      throw new Error(`Unsupported schedule type: ${scheduleType}`);
  }
}

function calculateDailyNextRun(now: Date, time: string, timezone: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const nextRun = new Date(now);
  
  nextRun.setHours(hours, minutes, 0, 0);

  // If the time has already passed today, schedule for tomorrow
  if (nextRun <= now) {
    nextRun.setDate(nextRun.getDate() + 1);
  }

  return nextRun;
}

function calculateWeeklyNextRun(
  now: Date,
  dayOfWeek: string,
  time: string,
  timezone: string
): Date {
  const daysOfWeek = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const targetDay = daysOfWeek.indexOf(dayOfWeek.toLowerCase());
  const currentDay = now.getDay();

  const [hours, minutes] = time.split(":").map(Number);
  const nextRun = new Date(now);

  // Calculate days until target day
  let daysUntilTarget = targetDay - currentDay;
  if (daysUntilTarget < 0) {
    daysUntilTarget += 7;
  } else if (daysUntilTarget === 0) {
    // If it's the target day, check if time has passed
    nextRun.setHours(hours, minutes, 0, 0);
    if (nextRun <= now) {
      daysUntilTarget = 7; // Schedule for next week
    }
  }

  nextRun.setDate(now.getDate() + daysUntilTarget);
  nextRun.setHours(hours, minutes, 0, 0);

  return nextRun;
}

function calculateMonthlyFirstWeekdayNextRun(
  now: Date,
  dayOfWeek: string,
  time: string,
  timezone: string
): Date {
  const daysOfWeek = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const targetDay = daysOfWeek.indexOf(dayOfWeek.toLowerCase());
  const [hours, minutes] = time.split(":").map(Number);

  // Start with the first day of the current month
  let nextRun = new Date(now.getFullYear(), now.getMonth(), 1);

  // Find the first occurrence of the target day in the month
  while (nextRun.getDay() !== targetDay) {
    nextRun.setDate(nextRun.getDate() + 1);
  }

  nextRun.setHours(hours, minutes, 0, 0);

  // If this date has already passed, move to next month
  if (nextRun <= now) {
    nextRun = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    while (nextRun.getDay() !== targetDay) {
      nextRun.setDate(nextRun.getDate() + 1);
    }
    nextRun.setHours(hours, minutes, 0, 0);
  }

  return nextRun;
}

function calculateMonthlyLastWeekdayNextRun(
  now: Date,
  dayOfWeek: string,
  time: string,
  timezone: string
): Date {
  const daysOfWeek = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const targetDay = daysOfWeek.indexOf(dayOfWeek.toLowerCase());
  const [hours, minutes] = time.split(":").map(Number);

  // Start with the last day of the current month
  let nextRun = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // Find the last occurrence of the target day in the month
  while (nextRun.getDay() !== targetDay) {
    nextRun.setDate(nextRun.getDate() - 1);
  }

  nextRun.setHours(hours, minutes, 0, 0);

  // If this date has already passed, move to next month
  if (nextRun <= now) {
    nextRun = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    while (nextRun.getDay() !== targetDay) {
      nextRun.setDate(nextRun.getDate() - 1);
    }
    nextRun.setHours(hours, minutes, 0, 0);
  }

  return nextRun;
}

/**
 * Parse a cron expression and calculate the next run time
 * Note: For production use, consider using a library like 'cron-parser'
 */
export function parseCronExpression(
  cronExpression: string,
  timezone: string = "UTC"
): Date {
  // This is a simplified implementation
  // For production, use: import parser from 'cron-parser'
  // const interval = parser.parseExpression(cronExpression, { tz: timezone });
  // return interval.next().toDate();

  // For now, return next hour as a placeholder
  const now = new Date();
  now.setHours(now.getHours() + 1, 0, 0, 0);
  return now;
}

