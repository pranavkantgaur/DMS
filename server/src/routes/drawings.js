const express = require('express');
const path = require('path');
const fs = require('fs');
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

const UPLOAD_DIR = path.resolve(__dirname, '../../uploads');

/** Safely delete a file, logging any errors. */
function safeUnlink(filePath) {
  fs.unlink(filePath, (err) => {
    if (err) console.error(`Failed to delete file ${filePath}:`, err.message);
  });
}

/**
 * Validates that the resolved file path is inside the upload directory
 * to prevent path-traversal attacks.
 */
function resolveUploadPath(filePath) {
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(UPLOAD_DIR + path.sep) && resolved !== UPLOAD_DIR) {
    return null;
  }
  return resolved;
}

// GET /api/drawings/by-component - drawings grouped by component (plant_id required)
// NOTE: This route must be defined BEFORE /:id to avoid route conflict
router.get('/by-component', authenticateToken, async (req, res) => {
  try {
    const { plant_id } = req.query;
    if (!plant_id) {
      return res.status(400).json({ error: 'plant_id query parameter is required' });
    }

    const [rows] = await pool.execute(
      `SELECT d.id, d.title, d.description, d.drawing_number, d.revision, d.file_name,
              d.component_id, d.department_id, d.plant_id, d.status, d.uploaded_by,
              d.created_at, d.updated_at,
              pc.name AS component_name, dept.name AS department_name,
              p.name AS plant_name, u.username AS uploaded_by_username
       FROM drawings d
       LEFT JOIN plant_components pc ON d.component_id = pc.id
       JOIN departments dept ON d.department_id = dept.id
       JOIN plants p ON d.plant_id = p.id
       JOIN users u ON d.uploaded_by = u.id
       WHERE d.plant_id = ?
       ORDER BY pc.name, d.title`,
      [plant_id]
    );

    // Group by component
    const grouped = {};
    for (const row of rows) {
      const key = row.component_id || 'unassigned';
      const label = row.component_name || 'Unassigned';
      if (!grouped[key]) {
        grouped[key] = { component_id: row.component_id, component_name: label, drawings: [] };
      }
      grouped[key].drawings.push(row);
    }

    res.json({ data: Object.values(grouped) });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/drawings - list all with optional filters
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { plant_id, department_id, component_id, status, search } = req.query;
    const conditions = [];
    const values = [];

    if (plant_id) { conditions.push('d.plant_id = ?'); values.push(plant_id); }
    if (department_id) { conditions.push('d.department_id = ?'); values.push(department_id); }
    if (component_id) { conditions.push('d.component_id = ?'); values.push(component_id); }
    if (status) { conditions.push('d.status = ?'); values.push(status); }
    if (search) {
      conditions.push('(d.title LIKE ? OR d.drawing_number LIKE ? OR d.description LIKE ?)');
      const like = `%${search}%`;
      values.push(like, like, like);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await pool.execute(
      `SELECT d.id, d.title, d.description, d.drawing_number, d.revision, d.file_name,
              d.component_id, d.department_id, d.plant_id, d.status, d.uploaded_by,
              d.created_at, d.updated_at,
              pc.name AS component_name, dept.name AS department_name,
              p.name AS plant_name, u.username AS uploaded_by_username
       FROM drawings d
       LEFT JOIN plant_components pc ON d.component_id = pc.id
       JOIN departments dept ON d.department_id = dept.id
       JOIN plants p ON d.plant_id = p.id
       JOIN users u ON d.uploaded_by = u.id
       ${where}
       ORDER BY d.created_at DESC`,
      values
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/drawings/:id - get single drawing
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT d.id, d.title, d.description, d.drawing_number, d.revision, d.file_name,
              d.component_id, d.department_id, d.plant_id, d.status, d.uploaded_by,
              d.created_at, d.updated_at,
              pc.name AS component_name, dept.name AS department_name,
              p.name AS plant_name, u.username AS uploaded_by_username
       FROM drawings d
       LEFT JOIN plant_components pc ON d.component_id = pc.id
       JOIN departments dept ON d.department_id = dept.id
       JOIN plants p ON d.plant_id = p.id
       JOIN users u ON d.uploaded_by = u.id
       WHERE d.id = ?`,
      [req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Drawing not found' });
    }
    res.json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/drawings - upload new drawing (PDF only, multipart/form-data)
router.post(
  '/',
  authenticateToken,
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'PDF file is required' });
      }

      const { title, description, drawing_number, revision, component_id, department_id, plant_id } = req.body;

      if (!title || !department_id || !plant_id) {
        // Remove uploaded file on validation failure
        safeUnlink(req.file.path);
        return res.status(400).json({ error: 'title, department_id, and plant_id are required' });
      }

      // Validate foreign keys
      const [plantRows] = await pool.execute('SELECT id FROM plants WHERE id = ?', [plant_id]);
      if (!plantRows.length) {
        safeUnlink(req.file.path);
        return res.status(404).json({ error: 'Plant not found' });
      }

      const [deptRows] = await pool.execute('SELECT id FROM departments WHERE id = ?', [department_id]);
      if (!deptRows.length) {
        safeUnlink(req.file.path);
        return res.status(404).json({ error: 'Department not found' });
      }

      if (component_id) {
        const [compRows] = await pool.execute('SELECT id FROM plant_components WHERE id = ?', [component_id]);
        if (!compRows.length) {
          safeUnlink(req.file.path);
          return res.status(404).json({ error: 'Component not found' });
        }
      }

      const [result] = await pool.execute(
        `INSERT INTO drawings
           (title, description, drawing_number, revision, file_path, file_name,
            component_id, department_id, plant_id, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          title,
          description || null,
          drawing_number || null,
          revision || 'A',
          req.file.path,
          req.file.filename,
          component_id || null,
          department_id,
          plant_id,
          req.user.id,
        ]
      );

      res.status(201).json({
        data: {
          id: result.insertId,
          title,
          file_name: req.file.filename,
          drawing_number: drawing_number || null,
          revision: revision || 'A',
        },
        message: 'Drawing uploaded successfully',
      });
    } catch (err) {
      if (req.file) safeUnlink(req.file.path);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// PUT /api/drawings/:id - update drawing metadata (admin/supervisor)
router.put('/:id', authenticateToken, requireRole('admin', 'supervisor'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, drawing_number, revision, component_id, department_id, plant_id, status } = req.body;

    const [rows] = await pool.execute('SELECT id FROM drawings WHERE id = ?', [id]);
    if (!rows.length) {
      return res.status(404).json({ error: 'Drawing not found' });
    }

    const validStatuses = ['active', 'archived', 'under_review'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const fields = [];
    const values = [];

    if (title !== undefined) { fields.push('title = ?'); values.push(title); }
    if (description !== undefined) { fields.push('description = ?'); values.push(description); }
    if (drawing_number !== undefined) { fields.push('drawing_number = ?'); values.push(drawing_number); }
    if (revision !== undefined) { fields.push('revision = ?'); values.push(revision); }
    if (component_id !== undefined) { fields.push('component_id = ?'); values.push(component_id || null); }
    if (department_id !== undefined) { fields.push('department_id = ?'); values.push(department_id); }
    if (plant_id !== undefined) { fields.push('plant_id = ?'); values.push(plant_id); }
    if (status !== undefined) { fields.push('status = ?'); values.push(status); }

    if (!fields.length) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);
    await pool.execute(`UPDATE drawings SET ${fields.join(', ')} WHERE id = ?`, values);
    res.json({ message: 'Drawing updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/drawings/:id - delete drawing + file (admin/supervisor)
router.delete('/:id', authenticateToken, requireRole('admin', 'supervisor'), async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.execute('SELECT id, file_path FROM drawings WHERE id = ?', [id]);
    if (!rows.length) {
      return res.status(404).json({ error: 'Drawing not found' });
    }

    const filePath = rows[0].file_path;
    await pool.execute('DELETE FROM drawings WHERE id = ?', [id]);

    // Best-effort file deletion (validate path stays within upload dir)
    if (filePath) {
      const safePath = resolveUploadPath(filePath);
      if (safePath && fs.existsSync(safePath)) {
        safeUnlink(safePath);
      }
    }

    res.json({ message: 'Drawing deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/drawings/:id/download - serve the PDF file
router.get('/:id/download', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, file_path, file_name, title FROM drawings WHERE id = ?',
      [req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Drawing not found' });
    }

    const { file_path, file_name } = rows[0];
    const absolutePath = resolveUploadPath(file_path);

    if (!absolutePath) {
      return res.status(403).json({ error: 'Invalid file path' });
    }

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ error: 'File not found on server' });
    }

    // Sanitize filename for Content-Disposition header
    const safeFileName = path.basename(file_name).replace(/[^\w.\-]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);
    res.sendFile(absolutePath);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
