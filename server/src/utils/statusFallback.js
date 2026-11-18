/**
 * Utility helper to detect missing 'status' column in 'lectures' table
 * and safely handle queries, inserts, and updates without breaking zero-downtime compatibility.
 */

function isStatusColumnError(err) {
  if (!err) return false;
  const msg = String(err.message || '').toLowerCase();
  const details = String(err.details || '').toLowerCase();
  return (
    err.code === '42703' ||
    err.code === 'PGRST204' ||
    msg.includes("'status'") ||
    msg.includes('"status"') ||
    msg.includes('column status') ||
    details.includes('status')
  );
}

function removeStatusFromSelect(selectString) {
  if (typeof selectString !== 'string') return selectString;
  return selectString
    .replace(/\bstatus\s*,/g, '')
    .replace(/,\s*\bstatus\b/g, '')
    .replace(/^\s*status\s*,?\s*$/gm, '')
    .replace(/,\s*,+/g, ',')
    .trim();
}

function stripStatusFromPayload(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  if (Array.isArray(payload)) {
    return payload.map((item) => stripStatusFromPayload(item));
  }
  const copy = { ...payload };
  delete copy.status;
  return copy;
}

module.exports = {
  isStatusColumnError,
  removeStatusFromSelect,
  stripStatusFromPayload,
};
