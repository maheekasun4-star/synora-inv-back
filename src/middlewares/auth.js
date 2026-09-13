const jwt = require('jsonwebtoken');

/**
 * JWT auth middleware — reads the same JWT_SECRET and ella_pms users table
 * as Ella PMS and KOT-BOT POS. No changes needed to the other apps.
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  const queryToken = req.query && req.query.token ? String(req.query.token) : '';
  const token = header && header.startsWith('Bearer ') ? header.slice(7) : queryToken;

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, username, role, roleId }
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Role guard — pass one role string or an array of allowed roles.
 * Example: requireRole('admin') or requireRole(['admin', 'cost_controller'])
 */
function requireRole(roles) {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    if (!req.user || !allowed.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient role' });
    }
    next();
  };
}

function requireAdmin(req, res, next) {
  return requireRole('admin')(req, res, next);
}

module.exports = { authenticate, requireRole, requireAdmin };
