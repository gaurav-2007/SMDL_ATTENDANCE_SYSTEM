/**
 * roles.js — Role-based access control middleware
 */

/**
 * restrictTo(...roles)
 * Allows only users whose role matches one of the given roles.
 * Must be used AFTER the protect (auth) middleware.
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(' or ')}`,
      });
    }
    next();
  };
};

/**
 * restrictToActiveOnly
 * Blocks users whose account status is not ACTIVE.
 * Must be used AFTER the protect (auth) middleware.
 */
const restrictToActiveOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }
  if (req.user.status !== 'ACTIVE') {
    return res.status(403).json({
      success: false,
      message: 'Your account is not active. Please wait for admin approval.',
    });
  }
  next();
};

module.exports = { restrictTo, restrictToActiveOnly };
