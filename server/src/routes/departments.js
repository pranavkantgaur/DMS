const express = require('express');
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

const ER_ROW_IS_REFERENCED = 'ER_ROW_IS_REFERENCED_2';

// GET /api/departments - all authenticated users
router.get('/', authenticateToken, async (_req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, name, description, created_at FROM departments ORDER BY name'
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/departments/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, name, description, created_at FROM departments WHERE id = ?',
      [req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Department not found' });
    }
    res.json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/departments - admin only
router.post('/', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Department name is required' });
    }

    const [existing] = await pool.execute('SELECT id FROM departments WHERE name = ?', [name]);
    if (existing.length) {
      return res.status(409).json({ error: 'Department name already exists' });
    }

    const [result] = await pool.execute(
      'INSERT INTO departments (name, description) VALUES (?, ?)',
      [name, description || null]
    );
    res.status(201).json({
      data: { id: result.insertId, name, description: description || null },
      message: 'Department created successfully',
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/departments/:id - admin only
router.put('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const [rows] = await pool.execute('SELECT id FROM departments WHERE id = ?', [id]);
    if (!rows.length) {
      return res.status(404).json({ error: 'Department not found' });
    }

    const fields = [];
    const values = [];

    if (name !== undefined) { fields.push('name = ?'); values.push(name); }
    if (description !== undefined) { fields.push('description = ?'); values.push(description); }

    if (!fields.length) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);
    await pool.execute(`UPDATE departments SET ${fields.join(', ')} WHERE id = ?`, values);
    res.json({ message: 'Department updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/departments/:id - admin only
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.execute('SELECT id FROM departments WHERE id = ?', [id]);
    if (!rows.length) {
      return res.status(404).json({ error: 'Department not found' });
    }

    await pool.execute('DELETE FROM departments WHERE id = ?', [id]);
    res.json({ message: 'Department deleted successfully' });
  } catch (err) {
    if (err.code === ER_ROW_IS_REFERENCED) {
      return res.status(409).json({ error: 'Cannot delete department with associated records' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
