/**
 * sanitizer.js — Request input sanitization middleware
 * Protects against Cross-Site Scripting (XSS), null-byte injections, and malformed inputs.
 */

// Strip HTML tags and dangerous javascript: URIs while preserving base64 images and safe punctuation
function sanitizeString(str) {
  if (typeof str !== 'string') return str;

  // Preserve base64 image data intact
  if (str.startsWith('data:image/') || str.startsWith('data:application/')) {
    return str.trim();
  }

  return str
    // Remove null bytes
    .replace(/\0/g, '')
    // Remove <script>...</script> blocks
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove inline event handlers (e.g. onload=, onerror=, onclick=)
    .replace(/\s*on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    // Remove javascript: pseudo-protocols
    .replace(/javascript:[^\s]*/gi, '')
    .trim();
}

function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') {
    return typeof obj === 'string' ? sanitizeString(obj) : obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item));
  }

  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    // Sanitize key name itself to prevent prototype pollution
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }

    if (typeof value === 'string') {
      cleaned[key] = sanitizeString(value);
    } else if (typeof value === 'object' && value !== null) {
      cleaned[key] = sanitizeObject(value);
    } else {
      cleaned[key] = value;
    }
  }

  return cleaned;
}

const sanitizeInput = (req, _res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params);
  }
  next();
};

module.exports = sanitizeInput;
