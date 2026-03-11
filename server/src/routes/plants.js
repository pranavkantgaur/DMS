const express = require('express');
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/plants - all authenticated users
router.get('/', authenticateToken, async (_req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, name, location, description, created_at FROM plants ORDER BY name'
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/plants/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, name, location, description, created_at FROM plants WHERE id = ?',
      [req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Plant not found' });
    }
    res.json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/plants/:id/components - list components for a plant
router.get('/:id/components', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [plantRows] = await pool.execute('SELECT id FROM plants WHERE id = ?', [id]);
    if (!plantRows.length) {
      return res.status(404).json({ error: 'Plant not found' });
    }

    const [rows] = await pool.execute(
      `SELECT pc.id, pc.plant_id, pc.department_id, pc.name, pc.description, pc.created_at,
              p.name AS plant_name, d.name AS department_name
       FROM plant_components pc
       JOIN plants p ON pc.plant_id = p.id
       JOIN departments d ON pc.department_id = d.id
       WHERE pc.plant_id = ?
       ORDER BY pc.name`,
      [id]
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/plants - admin only
router.post('/', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { name, location, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Plant name is required' });
    }

    const [result] = await pool.execute(
      'INSERT INTO plants (name, location, description) VALUES (?, ?, ?)',
      [name, location || null, description || null]
    );
    res.status(201).json({
      data: { id: result.insertId, name, location: location || null, description: description || null },
      message: 'Plant created successfully',
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/plants/:id - admin only
router.put('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, location, description } = req.body;

    const [rows] = await pool.execute('SELECT id FROM plants WHERE id = ?', [id]);
    if (!rows.length) {
      return res.status(404).json({ error: 'Plant not found' });
    }

    const fields = [];
    const values = [];

    if (name !== undefined) { fields.push('name = ?'); values.push(name); }
    if (location !== undefined) { fields.push('location = ?'); values.push(location); }
    if (description !== undefined) { fields.push('description = ?'); values.push(description); }

    if (!fields.length) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);
    await pool.execute(`UPDATE plants SET ${fields.join(', ')} WHERE id = ?`, values);
    res.json({ message: 'Plant updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/plants/:id - admin only
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.execute('SELECT id FROM plants WHERE id = ?', [id]);
    if (!rows.length) {
      return res.status(404).json({ error: 'Plant not found' });
    }

    await pool.execute('DELETE FROM plants WHERE id = ?', [id]);
    res.json({ message: 'Plant deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
