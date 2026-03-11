const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const [rows] = await pool.execute(
      'SELECT id, username, email, role, department_id, is_active FROM users WHERE id = ?',
      [decoded.userId]
    );
    if (!rows.length || !rows[0].is_active) {
      return res.status(401).json({ error: 'Invalid or inactive user' });
    }
    req.user = rows[0];
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
};

module.exports = { authenticateToken, requireRole };
