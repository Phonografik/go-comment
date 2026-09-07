// Small, locale-independent formatters. Hand-rolled so "Sep" never becomes
// ICU's "Sept" and the tests see the same strings as the popup.
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Wed 9 Sep" */
export function formatDay(date: Date): string {
  return `${DAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** "3 Sep 2026" */
export function formatLongDate(ms: number): string {
  const date = new Date(ms);
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** "3 days ago" / "1 day ago" / "today" */
export function daysAgo(days: number): string {
  if (days <= 0) return 'today';
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/** The browser family + major version from a user-agent string — never the whole UA. */
export function browserName(ua: string): string {
  const pick = (re: RegExp, name: string) => {
    const m = ua.match(re);
    return m ? `${name} ${m[1]}` : undefined;
  };
  return (
    pick(/\bEdg\/(\d+)/, 'Edge') ??
    pick(/\bOPR\/(\d+)/, 'Opera') ??
    pick(/\bFirefox\/(\d+)/, 'Firefox') ??
    pick(/\bChrome\/(\d+)/, 'Chrome') ??
    pick(/\bVersion\/(\d+).*Safari/, 'Safari') ??
    'unknown'
  );
}
