const express = require('express');
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/components - optionally filtered by plant_id and/or department_id
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { plant_id, department_id } = req.query;
    const conditions = [];
    const values = [];

    if (plant_id) { conditions.push('pc.plant_id = ?'); values.push(plant_id); }
    if (department_id) { conditions.push('pc.department_id = ?'); values.push(department_id); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await pool.execute(
      `SELECT pc.id, pc.plant_id, pc.department_id, pc.name, pc.description, pc.created_at,
              p.name AS plant_name, d.name AS department_name
       FROM plant_components pc
       JOIN plants p ON pc.plant_id = p.id
       JOIN departments d ON pc.department_id = d.id
       ${where}
       ORDER BY p.name, pc.name`,
      values
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/components/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT pc.id, pc.plant_id, pc.department_id, pc.name, pc.description, pc.created_at,
              p.name AS plant_name, d.name AS department_name
       FROM plant_components pc
       JOIN plants p ON pc.plant_id = p.id
       JOIN departments d ON pc.department_id = d.id
       WHERE pc.id = ?`,
      [req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Component not found' });
    }
    res.json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/components - admin or supervisor
router.post('/', authenticateToken, requireRole('admin', 'supervisor'), async (req, res) => {
  try {
    const { plant_id, department_id, name, description } = req.body;

    if (!plant_id || !department_id || !name) {
      return res.status(400).json({ error: 'plant_id, department_id, and name are required' });
    }

    const [plantRows] = await pool.execute('SELECT id FROM plants WHERE id = ?', [plant_id]);
    if (!plantRows.length) {
      return res.status(404).json({ error: 'Plant not found' });
    }

    const [deptRows] = await pool.execute('SELECT id FROM departments WHERE id = ?', [department_id]);
    if (!deptRows.length) {
      return res.status(404).json({ error: 'Department not found' });
    }

    const [result] = await pool.execute(
      'INSERT INTO plant_components (plant_id, department_id, name, description) VALUES (?, ?, ?, ?)',
      [plant_id, department_id, name, description || null]
    );
    res.status(201).json({
      data: { id: result.insertId, plant_id, department_id, name, description: description || null },
      message: 'Component created successfully',
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/components/:id - admin or supervisor
router.put('/:id', authenticateToken, requireRole('admin', 'supervisor'), async (req, res) => {
  try {
    const { id } = req.params;
    const { plant_id, department_id, name, description } = req.body;

    const [rows] = await pool.execute('SELECT id FROM plant_components WHERE id = ?', [id]);
    if (!rows.length) {
      return res.status(404).json({ error: 'Component not found' });
    }

    const fields = [];
    const values = [];

    if (plant_id !== undefined) { fields.push('plant_id = ?'); values.push(plant_id); }
    if (department_id !== undefined) { fields.push('department_id = ?'); values.push(department_id); }
    if (name !== undefined) { fields.push('name = ?'); values.push(name); }
    if (description !== undefined) { fields.push('description = ?'); values.push(description); }

    if (!fields.length) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);
    await pool.execute(`UPDATE plant_components SET ${fields.join(', ')} WHERE id = ?`, values);
    res.json({ message: 'Component updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/components/:id - admin only
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.execute('SELECT id FROM plant_components WHERE id = ?', [id]);
    if (!rows.length) {
      return res.status(404).json({ error: 'Component not found' });
    }

    await pool.execute('DELETE FROM plant_components WHERE id = ?', [id]);
    res.json({ message: 'Component deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
