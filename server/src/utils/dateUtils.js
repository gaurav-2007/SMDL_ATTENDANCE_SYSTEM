/**
 * SMDL College - Timezone & Date Utilities
 * Ensures all dates and times are strictly computed in Asia/Kolkata (IST, UTC+5:30)
 */

function getKolkataDateString(date = new Date()) {
  let d = date;
  if (typeof date === 'string') {
    // If date string is YYYY-MM-DD, parse as noon IST to prevent midnight boundary drift
    d = date.length === 10 ? new Date(`${date}T12:00:00+05:30`) : new Date(date);
  }
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d); // Strictly YYYY-MM-DD
}

function getKolkataDayName(date = new Date()) {
  let d = date;
  if (typeof date === 'string') {
    d = date.length === 10 ? new Date(`${date}T12:00:00+05:30`) : new Date(date);
  }
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
  }).format(d); // E.g. 'Sunday', 'Monday', etc.
}

function getKolkataTimeString(date = new Date()) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date); // HH:MM:SS
}

function getKolkataMinutes(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
  return hour * 60 + minute;
}

module.exports = {
  getKolkataDateString,
  getKolkataDayName,
  getKolkataTimeString,
  getKolkataMinutes,
};

