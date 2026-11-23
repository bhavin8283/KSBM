export type DateFormat = 'DD-MM-YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'MM/DD/YYYY' | 'D MMM YYYY';
export type TimeFormat = '12h' | '24h';

export interface RegionalSettings {
  dateFormat: DateFormat;
  timeFormat: TimeFormat;
  timeZone: string;
  timeZoneLabel: string;
}

export const DEFAULT_REGIONAL_SETTINGS: RegionalSettings = {
  dateFormat: 'DD-MM-YYYY',
  timeFormat: '12h',
  timeZone: 'Australia/Brisbane',
  timeZoneLabel: 'Brisbane, Queensland (AEST UTC+10 - No DST)',
};

export const AVAILABLE_TIMEZONES = [
  { value: 'Australia/Brisbane', label: 'Brisbane, Queensland (AEST UTC+10 - No DST)', offset: '+10:00' },
  { value: 'Australia/Sydney', label: 'Sydney, New South Wales (AEST/AEDT UTC+10/+11)', offset: '+10:00' },
  { value: 'Australia/Melbourne', label: 'Melbourne, Victoria (AEST/AEDT UTC+10/+11)', offset: '+10:00' },
  { value: 'Australia/Perth', label: 'Perth, Western Australia (AWST UTC+8)', offset: '+08:00' },
  { value: 'Australia/Adelaide', label: 'Adelaide, South Australia (ACST/ACDT UTC+9:30)', offset: '+09:30' },
  { value: 'Australia/Darwin', label: 'Darwin, Northern Territory (ACST UTC+9:30)', offset: '+09:30' },
  { value: 'Australia/Hobart', label: 'Hobart, Tasmania (AEST/AEDT UTC+10/+11)', offset: '+10:00' },
  { value: 'Pacific/Auckland', label: 'Auckland / Wellington, New Zealand (NZST/NZDT)', offset: '+12:00' },
  { value: 'Asia/Singapore', label: 'Singapore / Malaysia (SGT UTC+8)', offset: '+08:00' },
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)', offset: '+00:00' },
  { value: 'Europe/London', label: 'London, United Kingdom (GMT/BST)', offset: '+00:00' },
  { value: 'America/New_York', label: 'New York, United States (EST/EDT)', offset: '-05:00' },
  { value: 'America/Los_Angeles', label: 'Los Angeles, United States (PST/PDT)', offset: '-08:00' },
];

export const AVAILABLE_DATE_FORMATS: { value: DateFormat; label: string; example: string }[] = [
  { value: 'DD-MM-YYYY', label: 'DD-MM-YYYY (Hyphen separated - Default)', example: '29-08-2026' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (Slash separated)', example: '29/08/2026' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (ISO Standard)', example: '2026-08-29' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (US Format)', example: '08/29/2026' },
  { value: 'D MMM YYYY', label: 'D MMM YYYY (Day Month Year)', example: '29 Aug 2026' },
];

export const AVAILABLE_TIME_FORMATS: { value: TimeFormat; label: string; example: string }[] = [
  { value: '12h', label: '12-Hour (AM/PM Display - Default)', example: '02:30 PM' },
  { value: '24h', label: '24-Hour (Military / POS Clock)', example: '14:30' },
];

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

/**
 * Parses any date-like input safely.
 */
export function parseDateInput(input: Date | string | number | null | undefined): Date | null {
  if (input === null || input === undefined || input === '') return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;

  if (typeof input === 'number') {
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  }

  const str = String(input).trim();
  if (!str || str.toLowerCase() === 'n/a' || str.toLowerCase() === 'null') return null;

  // Handle plain YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
  }

  // Handle plain DD-MM-YYYY or DD/MM/YYYY
  if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(str)) {
    const parts = str.split(/[-/]/).map(Number);
    return new Date(parts[2], parts[1] - 1, parts[0], 12, 0, 0);
  }

  // Handle standard ISO or SQL date time
  const parsed = new Date(str.replace(' ', 'T'));
  if (!isNaN(parsed.getTime())) return parsed;

  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? null : fallback;
}

/**
 * Formats date part according to specified or default format in given timezone.
 */
export function formatDate(
  input: Date | string | number | null | undefined,
  format: DateFormat = 'DD-MM-YYYY',
  timeZone: string = 'Australia/Brisbane'
): string {
  const d = parseDateInput(input);
  if (!d) return 'N/A';

  try {
    const formatter = new Intl.DateTimeFormat('en-AU', {
      timeZone: timeZone || 'Australia/Brisbane',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    const parts = formatter.formatToParts(d);
    let day = '';
    let month = '';
    let year = '';

    for (const p of parts) {
      if (p.type === 'day') day = p.value;
      if (p.type === 'month') month = p.value;
      if (p.type === 'year') year = p.value;
    }

    if (!day || !month || !year) {
      day = String(d.getDate()).padStart(2, '0');
      month = String(d.getMonth() + 1).padStart(2, '0');
      year = String(d.getFullYear());
    }

    const monthNum = parseInt(month, 10);
    const monthShort = MONTH_NAMES_SHORT[monthNum - 1] || month;
    const dayTrimmed = parseInt(day, 10).toString();

    switch (format) {
      case 'DD-MM-YYYY':
        return `${day}-${month}-${year}`;
      case 'DD/MM/YYYY':
        return `${day}/${month}/${year}`;
      case 'YYYY-MM-DD':
        return `${year}-${month}-${day}`;
      case 'MM/DD/YYYY':
        return `${month}/${day}/${year}`;
      case 'D MMM YYYY':
        return `${dayTrimmed} ${monthShort} ${year}`;
      default:
        return `${day}-${month}-${year}`;
    }
  } catch (e) {
    // Fallback if Intl fails
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear());
    return `${day}-${month}-${year}`;
  }
}

/**
 * Formats time string or Date object into 12h AM/PM or 24h format.
 */
export function formatTime(
  input: Date | string | number | null | undefined,
  timeFormat: TimeFormat = '12h',
  timeZone: string = 'Australia/Brisbane',
  includeSeconds: boolean = false
): string {
  if (input === null || input === undefined || input === '') return '';

  // If input is purely a time string like "14:30:00" or "07:15"
  if (typeof input === 'string' && /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.test(input.trim())) {
    const match = input.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (match) {
      let hours = parseInt(match[1], 10);
      const minutes = match[2];
      const seconds = match[3] || '00';

      if (timeFormat === '24h') {
        const hh = String(hours).padStart(2, '0');
        return includeSeconds ? `${hh}:${minutes}:${seconds}` : `${hh}:${minutes}`;
      } else {
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHour = hours % 12 || 12;
        const hh = String(displayHour).padStart(2, '0');
        return includeSeconds
          ? `${hh}:${minutes}:${seconds} ${ampm}`
          : `${hh}:${minutes} ${ampm}`;
      }
    }
  }

  const d = parseDateInput(input);
  if (!d) return '';

  try {
    const formatter = new Intl.DateTimeFormat('en-AU', {
      timeZone: timeZone || 'Australia/Brisbane',
      hour: 'numeric',
      minute: '2-digit',
      second: includeSeconds ? '2-digit' : undefined,
      hour12: timeFormat === '12h',
    });
    return formatter.format(d);
  } catch (e) {
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');

    if (timeFormat === '24h') {
      const hh = String(hours).padStart(2, '0');
      return includeSeconds ? `${hh}:${minutes}:${seconds}` : `${hh}:${minutes}`;
    } else {
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHour = hours % 12 || 12;
      const hh = String(displayHour).padStart(2, '0');
      return includeSeconds ? `${hh}:${minutes}:${seconds} ${ampm}` : `${hh}:${minutes} ${ampm}`;
    }
  }
}

/**
 * Formats full DateTime string into localized format e.g. "29-08-2026 02:30 PM".
 */
export function formatDateTime(
  input: Date | string | number | null | undefined,
  dateFormat: DateFormat = 'DD-MM-YYYY',
  timeFormat: TimeFormat = '12h',
  timeZone: string = 'Australia/Brisbane',
  includeSeconds: boolean = false
): string {
  if (!input) return 'N/A';

  // Check if it's already an object with date & time strings
  if (typeof input === 'object' && !(input instanceof Date)) {
    const obj = input as any;
    if (obj.date && obj.time) {
      const dStr = formatDate(obj.date, dateFormat, timeZone);
      const tStr = formatTime(obj.time, timeFormat, timeZone, includeSeconds);
      return `${dStr} ${tStr}`.trim();
    }
    if (obj.dateTime) {
      return formatDateTime(obj.dateTime, dateFormat, timeFormat, timeZone, includeSeconds);
    }
  }

  const dateStr = formatDate(input, dateFormat, timeZone);
  if (dateStr === 'N/A') return 'N/A';
  const timeStr = formatTime(input, timeFormat, timeZone, includeSeconds);

  return timeStr ? `${dateStr} ${timeStr}` : dateStr;
}

/**
 * Formats hourly chart labels e.g. "07:00" -> "7:00 AM" or "7 AM" or "07:00".
 */
export function formatHourLabel(
  hourInput: string | number,
  timeFormat: TimeFormat = '12h',
  short: boolean = false
): string {
  let h = 0;
  if (typeof hourInput === 'number') {
    h = Math.floor(hourInput);
  } else {
    const cleaned = String(hourInput).trim().replace(/[^\d:]/g, '');
    if (cleaned.includes(':')) {
      h = parseInt(cleaned.split(':')[0], 10);
    } else {
      h = parseInt(cleaned, 10);
    }
  }

  if (isNaN(h)) return String(hourInput);

  if (timeFormat === '24h') {
    return `${String(h).padStart(2, '0')}:00`;
  }

  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayHour = h % 12 || 12;

  if (short) {
    return `${displayHour} ${ampm}`;
  }
  return `${displayHour}:00 ${ampm}`;
}

/**
 * Returns YYYY-MM-DD date string representing "today" in the specified timezone (Brisbane default).
 */
export function getTodayDateStr(timeZone: string = 'Australia/Brisbane'): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone || 'Australia/Brisbane',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date());
  } catch (e) {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

/**
 * Returns YYYY-MM-DD date string representing "yesterday" in the specified timezone.
 */
export function getYesterdayDateStr(timeZone: string = 'Australia/Brisbane'): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone || 'Australia/Brisbane',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(d);
  } catch (e) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
