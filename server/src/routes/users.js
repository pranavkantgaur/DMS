const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/users - admin and supervisor can list all users
router.get('/', authenticateToken, requireRole('admin', 'supervisor'), async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT u.id, u.username, u.email, u.role, u.department_id, u.is_active, u.created_at, u.updated_at,
              d.name AS department_name
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       ORDER BY u.created_at DESC`
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    // Non-admins/supervisors can only view their own profile
    if (req.user.role === 'operator' && req.user.id !== parseInt(id)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const [rows] = await pool.execute(
      `SELECT u.id, u.username, u.email, u.role, u.department_id, u.is_active, u.created_at, u.updated_at,
              d.name AS department_name
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE u.id = ?`,
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users - admin only
router.post('/', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { username, email, password, role, department_id, is_active } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    const validRoles = ['admin', 'supervisor', 'operator'];
    const assignedRole = role && validRoles.includes(role) ? role : 'operator';

    const [existing] = await pool.execute(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );
    if (existing.length) {
      return res.status(409).json({ error: 'User could not be created' });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const activeStatus = is_active !== undefined ? is_active : true;

    const [result] = await pool.execute(
      'INSERT INTO users (username, email, password_hash, role, department_id, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      [username, email, password_hash, assignedRole, department_id || null, activeStatus]
    );

    res.status(201).json({
      data: { id: result.insertId, username, email, role: assignedRole, department_id: department_id || null, is_active: activeStatus },
      message: 'User created successfully',
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/users/:id - admin only
router.put('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, password, role, department_id, is_active } = req.body;

    const [rows] = await pool.execute('SELECT id FROM users WHERE id = ?', [id]);
    if (!rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Build dynamic update
    const fields = [];
    const values = [];

    if (username !== undefined) { fields.push('username = ?'); values.push(username); }
    if (email !== undefined) { fields.push('email = ?'); values.push(email); }
    if (password !== undefined) {
      const password_hash = await bcrypt.hash(password, 12);
      fields.push('password_hash = ?');
      values.push(password_hash);
    }
    if (role !== undefined) {
      const validRoles = ['admin', 'supervisor', 'operator'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      fields.push('role = ?');
      values.push(role);
    }
    if (department_id !== undefined) { fields.push('department_id = ?'); values.push(department_id || null); }
    if (is_active !== undefined) { fields.push('is_active = ?'); values.push(is_active); }

    if (!fields.length) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);
    await pool.execute(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);

    res.json({ message: 'User updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/users/:id - admin only
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.id === parseInt(id)) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const [rows] = await pool.execute('SELECT id FROM users WHERE id = ?', [id]);
    if (!rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    await pool.execute('DELETE FROM users WHERE id = ?', [id]);
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
