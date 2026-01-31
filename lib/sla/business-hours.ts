/**
 * Business hours calculation for SLA tracking
 * 
 * Handles timezone-aware business hours, working days, and holidays
 */

export interface BusinessHoursConfig {
  timezone: string;
  workingDays: number[]; // 1=Monday, 2=Tuesday, ..., 7=Sunday
  workingHours: { start: string; end: string }; // "HH:mm" format
  holidays?: string[]; // ISO date strings (YYYY-MM-DD)
}

export interface BusinessHoursResult {
  isBusinessHours: boolean;
  nextBusinessHour?: Date;
  hoursUntilNext?: number;
}

/**
 * Check if a given date/time is within business hours
 */
export function isBusinessHours(
  date: Date,
  config: BusinessHoursConfig | null
): boolean {
  if (!config) {
    // No business hours configured = 24/7
    return true;
  }

  // Convert date to organization's timezone
  const tzDate = new Date(
    date.toLocaleString('en-US', { timeZone: config.timezone })
  );

  const dayOfWeek = tzDate.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
  const normalizedDay = dayOfWeek === 0 ? 7 : dayOfWeek; // Convert to 1-7 format

  // Check if it's a working day
  if (!config.workingDays.includes(normalizedDay)) {
    return false;
  }

  // Check if it's a holiday
  const dateStr = tzDate.toISOString().split('T')[0];
  if (config.holidays?.includes(dateStr)) {
    return false;
  }

  // Check if it's within working hours
  const timeStr = tzDate.toTimeString().slice(0, 5); // "HH:mm"
  const { start, end } = config.workingHours;

  return timeStr >= start && timeStr < end;
}

/**
 * Get the next business hour start time
 */
export function getNextBusinessHour(
  fromDate: Date,
  config: BusinessHoursConfig | null
): Date | null {
  if (!config) {
    return null; // 24/7, no next business hour
  }

  const tzDate = new Date(
    fromDate.toLocaleString('en-US', { timeZone: config.timezone })
  );

  // Start checking from the next minute
  const checkDate = new Date(tzDate);
  checkDate.setMinutes(checkDate.getMinutes() + 1);
  checkDate.setSeconds(0);
  checkDate.setMilliseconds(0);

  // Check up to 7 days ahead
  for (let i = 0; i < 7 * 24 * 60; i++) {
    if (isBusinessHours(checkDate, config)) {
      // Convert back to UTC
      const localTimeStr = checkDate.toLocaleString('en-US', {
        timeZone: config.timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });

      // Parse and create UTC date
      const [datePart, timePart] = localTimeStr.split(', ');
      const [month, day, year] = datePart.split('/');
      const [hour, minute] = timePart.split(':');
      const utcDate = new Date(
        Date.UTC(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
          parseInt(hour),
          parseInt(minute)
        )
      );

      return utcDate;
    }

    checkDate.setMinutes(checkDate.getMinutes() + 1);
  }

  return null; // Couldn't find next business hour (shouldn't happen)
}

/**
 * Calculate business hours between two dates
 */
export function calculateBusinessHours(
  startDate: Date,
  endDate: Date,
  config: BusinessHoursConfig | null
): number {
  if (!config) {
    // 24/7 = return total hours
    return (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
  }

  let businessHours = 0;
  let current = new Date(startDate);

  // Iterate minute by minute (could be optimized for larger ranges)
  while (current < endDate) {
    if (isBusinessHours(current, config)) {
      businessHours += 1 / 60; // Add 1 minute in hours
    }
    current = new Date(current.getTime() + 60 * 1000); // Add 1 minute
  }

  return businessHours;
}

/**
 * Get default business hours configuration
 */
export function getDefaultBusinessHours(): BusinessHoursConfig {
  return {
    timezone: 'America/New_York',
    workingDays: [1, 2, 3, 4, 5], // Monday-Friday
    workingHours: {
      start: '09:00',
      end: '17:00',
    },
    holidays: [],
  };
}

