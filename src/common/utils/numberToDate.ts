const parseDeadlineInput = (input: any): Date | null => {
    if (input == null) return null;
    // already a Date
    if (input instanceof Date) return input;
    // number of days (numeric)
    if (typeof input === 'number' && Number.isFinite(input)) {
      return new Date(Date.now() + input * 24 * 60 * 60 * 1000);
    }
    if (typeof input === 'string') {
      const trimmed = input.trim();
      // numeric string -> days
      if (/^\d$/.test(trimmed)) {
        const days = parseInt(trimmed, 10);
        return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      }
      // ISO/date string
      const parsed = Date.parse(trimmed);
      if (!isNaN(parsed)) return new Date(parsed);
    }
    return null;
  }
/** * Convert various input types to a Date object or null.
 * - If input is null/undefined, returns null.
 * - If input is a Date object, returns it directly.
 * - If input is a number, treats it as days from now and returns the corresponding Date.
 * - If input is a numeric string, treats it as days from now and returns the corresponding Date.
 * - If input is a date string, attempts to parse it into a Date object.
 * - If parsing fails, returns null.
 */
export function numberToDate(input: any): Date | null {
    return parseDeadlineInput(input);
}