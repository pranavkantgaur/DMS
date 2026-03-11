const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const [rows] = await pool.execute(
      'SELECT id, username, email, role, department_id, is_active, password_hash FROM users WHERE username = ?',
      [username]
    );

    if (!rows.length) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = rows[0];

    if (!user.is_active) {
      return res.status(401).json({ error: 'Account is inactive' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          department_id: user.department_id,
        },
      },
      message: 'Login successful',
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/register
// First user is automatically admin; subsequent registrations require an admin token.
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, role, department_id } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    // Check if any users exist to determine if this is the first registration
    const [countRows] = await pool.execute('SELECT COUNT(*) AS total FROM users');
    const isFirstUser = countRows[0].total === 0;

    if (!isFirstUser) {
      // Require admin authentication for subsequent registrations
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      if (!token) {
        return res.status(401).json({ error: 'Admin authentication required to register new users' });
      }
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'admin') {
          return res.status(403).json({ error: 'Only admins can register new users' });
        }
      } catch {
        return res.status(403).json({ error: 'Invalid token' });
      }
    }

    // Validate role value if provided
    const validRoles = ['admin', 'supervisor', 'operator'];
    const assignedRole = isFirstUser ? 'admin' : (role && validRoles.includes(role) ? role : 'operator');

    // Check for duplicate username or email
    const [existing] = await pool.execute(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );
    if (existing.length) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    const password_hash = await bcrypt.hash(password, 12);

    const [result] = await pool.execute(
      'INSERT INTO users (username, email, password_hash, role, department_id) VALUES (?, ?, ?, ?, ?)',
      [username, email, password_hash, assignedRole, department_id || null]
    );

    res.status(201).json({
      data: { id: result.insertId, username, email, role: assignedRole },
      message: 'User registered successfully',
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT u.id, u.username, u.email, u.role, u.department_id, u.is_active, u.created_at,
              d.name AS department_name
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE u.id = ?`,
      [req.user.id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
